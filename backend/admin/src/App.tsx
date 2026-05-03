import { useCallback, useEffect, useState } from "react";
import { clearToken, downloadWithAuth, getToken, jfetch, setToken } from "./api";

type Tab = "login" | "pricing" | "subsidy" | "location" | "leads";

type Pricing = {
  panel: { cost_per_watt: number };
  inverter: { cost_per_kw: number };
  battery: { cost_per_kwh: number };
  installation: { base_amount: number; per_kw_amount: number };
  misc: { fixed_amount: number; percent_of_subtotal: number };
  estimation: {
    rupees_per_unit_default: number;
    units_per_kw_per_month: number;
    min_system_kw: number;
    max_system_kw: number;
  };
  roof_types: {
    id: number;
    roof_type: string;
    cost_multiplier: number;
    structure_fixed: number;
    structure_per_kw: number;
  }[];
};

type SubRow = {
  id: number;
  state_id: number;
  state_name: string;
  subsidy_type: string;
  value: number;
  max_limit: number | null;
  is_active: boolean;
};

type LocRow = {
  id: number;
  state_id: number | null;
  district_id: number | null;
  system_cost_multiplier: number;
  state_name: string | null;
  district_name: string | null;
  is_active: boolean;
};

type Lead = {
  id: number;
  name: string | null;
  phone: string | null;
  state: string | null;
  district: string | null;
  system_size: string | null;
  system_size_kw: number | null;
  estimated_cost: number | null;
  created_at: string;
};

type State = { id: number; name: string };

export function App() {
  const [tab, setTab] = useState<Tab>(getToken() ? "pricing" : "login");
  const [err, setErr] = useState<string | null>(null);
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  const [states, setStates] = useState<State[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [subsidies, setSubsidies] = useState<SubRow[]>([]);
  const [loc, setLoc] = useState<LocRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [newSub, setNewSub] = useState({
    state_id: 1,
    subsidy_type: "fixed",
    value: 40000,
    max_limit: 40000 as number | null,
  });
  const [newLoc, setNewLoc] = useState({
    state_id: 0,
    system_cost_multiplier: 1.0,
  });

  const loadStates = useCallback(() => {
    jfetch<State[]>("/states", { auth: false }).then(setStates).catch(() => {});
  }, []);

  const loadPricing = useCallback(() => {
    jfetch<Pricing>("/admin/pricing")
      .then(setPricing)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadSubsidies = useCallback(() => {
    jfetch<SubRow[]>("/admin/subsidy")
      .then(setSubsidies)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadLocation = useCallback(() => {
    jfetch<LocRow[]>("/admin/location-pricing")
      .then(setLoc)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadLeads = useCallback(() => {
    jfetch<Lead[]>("/admin/leads")
      .then(setLeads)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  useEffect(() => {
    if (tab === "pricing" && getToken()) loadPricing();
    if (tab === "subsidy" && getToken()) {
      loadSubsidies();
      loadStates();
    }
    if (tab === "location" && getToken()) {
      loadLocation();
      loadStates();
    }
    if (tab === "leads" && getToken()) loadLeads();
  }, [tab, loadPricing, loadSubsidies, loadLocation, loadLeads, loadStates]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await jfetch<{ access_token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: u, password: p }),
        auth: false,
      });
      setToken(r.access_token);
      setTab("pricing");
    } catch (q) {
      setErr(String(q));
    }
  }

  async function savePricing(e: React.FormEvent) {
    e.preventDefault();
    if (!pricing) return;
    setErr(null);
    try {
      const next = await jfetch<Pricing>("/admin/pricing", {
        method: "POST",
        body: JSON.stringify({
          panel: pricing.panel,
          inverter: pricing.inverter,
          battery: pricing.battery,
          installation: pricing.installation,
          misc: pricing.misc,
          estimation: pricing.estimation,
          roof_types: pricing.roof_types,
        }),
      });
      setPricing(next);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function addSubsidy(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const rows = await jfetch<SubRow[]>("/admin/subsidy", {
        method: "POST",
        body: JSON.stringify(newSub),
      });
      setSubsidies(rows);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoc.state_id) {
      setErr("Pick a state");
      return;
    }
    setErr(null);
    try {
      const rows = await jfetch<LocRow[]>("/admin/location-pricing", {
        method: "POST",
        body: JSON.stringify({
          state_id: newLoc.state_id,
          system_cost_multiplier: newLoc.system_cost_multiplier,
        }),
      });
      setLoc(rows);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function exportCsv() {
    const res = await downloadWithAuth("/export-leads");
    if (!res.ok) {
      setErr("Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (tab === "login" || !getToken()) {
    return (
      <div className="panel">
        <h1>NRGS — Admin</h1>
        <p style={{ color: "#8a9ba8" }}>Sign in to manage pricing and view leads.</p>
        {err ? <p className="err">{err}</p> : null}
        <form onSubmit={login} className="card" style={{ maxWidth: 360 }}>
          <div className="field">
            <label>Username</label>
            <input value={u} onChange={(e) => setU(e.target.value)} required />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Password</label>
            <input
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              required
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" className="btn">
              Log in
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <header className="topbar">
        <strong>NRGS Admin</strong>
        <nav className="nav">
          <button
            type="button"
            className={tab === "pricing" ? "active" : ""}
            onClick={() => setTab("pricing")}
          >
            Pricing
          </button>
          <button
            type="button"
            className={tab === "subsidy" ? "active" : ""}
            onClick={() => setTab("subsidy")}
          >
            Subsidy
          </button>
          <button
            type="button"
            className={tab === "location" ? "active" : ""}
            onClick={() => setTab("location")}
          >
            Location
          </button>
          <button
            type="button"
            className={tab === "leads" ? "active" : ""}
            onClick={() => setTab("leads")}
          >
            Leads
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              clearToken();
              setTab("login");
            }}
          >
            Log out
          </button>
        </nav>
      </header>
      {err ? <p className="err panel">{err}</p> : null}
      <div className="panel">
        {tab === "pricing" && pricing && (
          <form onSubmit={savePricing}>
            <h2>Component & estimation settings</h2>
            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field">
                <label>₹/W panel</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricing.panel.cost_per_watt}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      panel: { cost_per_watt: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>₹/kW inverter</label>
                <input
                  type="number"
                  step="1"
                  value={pricing.inverter.cost_per_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      inverter: { cost_per_kw: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>₹/kWh battery</label>
                <input
                  type="number"
                  step="1"
                  value={pricing.battery.cost_per_kwh}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      battery: { cost_per_kwh: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Install base (₹)</label>
                <input
                  type="number"
                  value={pricing.installation.base_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      installation: {
                        ...pricing.installation,
                        base_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Install / kW (₹)</label>
                <input
                  type="number"
                  value={pricing.installation.per_kw_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      installation: {
                        ...pricing.installation,
                        per_kw_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Misc fixed (₹)</label>
                <input
                  type="number"
                  value={pricing.misc.fixed_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      misc: {
                        ...pricing.misc,
                        fixed_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Misc % of pre-misc</label>
                <input
                  type="number"
                  step="0.001"
                  value={pricing.misc.percent_of_subtotal}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      misc: {
                        ...pricing.misc,
                        percent_of_subtotal: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Default ₹/unit (bill→kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing.estimation.rupees_per_unit_default}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        rupees_per_unit_default: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>kWh / month per kW (sizing)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing.estimation.units_per_kw_per_month}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        units_per_kw_per_month: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Min kW</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing.estimation.min_system_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        min_system_kw: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Max kW</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing.estimation.max_system_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        max_system_kw: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
            <h3 style={{ marginTop: 20 }}>Roof types</h3>
            {pricing.roof_types.map((r) => (
              <div
                key={r.id}
                className="grid2"
                style={{ marginTop: 8, alignItems: "end" }}
              >
                <div>
                  <strong>{r.roof_type}</strong>
                </div>
                <div className="field">
                  <label>× multip</label>
                  <input
                    type="number"
                    step="0.01"
                    value={r.cost_multiplier}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPricing({
                        ...pricing,
                        roof_types: pricing.roof_types.map((x) =>
                          x.id === r.id ? { ...x, cost_multiplier: v } : x
                        ),
                      });
                    }}
                  />
                </div>
                <div className="field">
                  <label>structure fixed</label>
                  <input
                    type="number"
                    value={r.structure_fixed}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPricing({
                        ...pricing,
                        roof_types: pricing.roof_types.map((x) =>
                          x.id === r.id ? { ...x, structure_fixed: v } : x
                        ),
                      });
                    }}
                  />
                </div>
                <div className="field">
                  <label>structure / kW</label>
                  <input
                    type="number"
                    value={r.structure_per_kw}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPricing({
                        ...pricing,
                        roof_types: pricing.roof_types.map((x) =>
                          x.id === r.id ? { ...x, structure_per_kw: v } : x
                        ),
                      });
                    }}
                  />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn">
                Save
              </button>
            </div>
          </form>
        )}

        {tab === "subsidy" && (
          <div>
            <h2>State subsidies</h2>
            <p style={{ color: "#8a9ba8" }}>
              Applied after the full system + misc pre-subsidy total. Latest active
              row per state is used in the public calculator.
            </p>
            <form onSubmit={addSubsidy} className="card" style={{ marginTop: 8 }}>
              <div className="grid2">
                <div className="field">
                  <label>State</label>
                  <select
                    value={newSub.state_id}
                    onChange={(e) =>
                      setNewSub({ ...newSub, state_id: +e.target.value })
                    }
                  >
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    value={newSub.subsidy_type}
                    onChange={(e) =>
                      setNewSub({ ...newSub, subsidy_type: e.target.value })
                    }
                  >
                    <option value="fixed">fixed (₹)</option>
                    <option value="percentage">percentage</option>
                  </select>
                </div>
                <div className="field">
                  <label>Value (₹ or %)</label>
                  <input
                    type="number"
                    value={newSub.value}
                    onChange={(e) =>
                      setNewSub({ ...newSub, value: +e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Max cap (₹)</label>
                  <input
                    type="number"
                    value={newSub.max_limit ?? ""}
                    onChange={(e) =>
                      setNewSub({
                        ...newSub,
                        max_limit: e.target.value ? +e.target.value : null,
                      })
                    }
                  />
                </div>
              </div>
              <button type="submit" className="btn" style={{ marginTop: 8 }}>
                Add record
              </button>
            </form>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>State</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {subsidies.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.state_name}</td>
                    <td>{s.subsidy_type}</td>
                    <td>{s.value}</td>
                    <td>{s.max_limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "location" && (
          <div>
            <h2>Location multipliers</h2>
            <p style={{ color: "#8a9ba8" }}>
              Multiplied against system subtotal (hardware + installation) before
              misc. More specific (district) beats state default.
            </p>
            <form onSubmit={addLocation} className="card" style={{ marginTop: 8 }}>
              <div className="grid2">
                <div className="field">
                  <label>State</label>
                  <select
                    value={newLoc.state_id || ""}
                    onChange={(e) =>
                      setNewLoc({ ...newLoc, state_id: +e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>× multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLoc.system_cost_multiplier}
                    onChange={(e) =>
                      setNewLoc({
                        ...newLoc,
                        system_cost_multiplier: +e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <button type="submit" className="btn" style={{ marginTop: 8 }}>
                Add
              </button>
            </form>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>State</th>
                  <th>District</th>
                  <th>×</th>
                </tr>
              </thead>
              <tbody>
                {loc.map((x) => (
                  <tr key={x.id}>
                    <td>{x.id}</td>
                    <td>{x.state_name}</td>
                    <td>{x.district_name}</td>
                    <td>{x.system_cost_multiplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "leads" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0 }}>Leads</h2>
              <button type="button" className="btn" onClick={exportCsv}>
                Export CSV
              </button>
            </div>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>State</th>
                  <th>Size</th>
                  <th>₹</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString()}</td>
                    <td>{l.name}</td>
                    <td>{l.phone}</td>
                    <td>{l.state}</td>
                    <td>{l.system_size}</td>
                    <td>{l.estimated_cost?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
