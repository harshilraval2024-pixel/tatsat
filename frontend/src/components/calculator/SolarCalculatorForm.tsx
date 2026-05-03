"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { jfetch } from "@/lib/nrgs-api";

type StateOpt = { id: number; name: string; code?: string };
type DistrictOpt = { id: number; name: string; state_id: number };

type CostBreakdown = {
  panels: number;
  inverter: number;
  battery: number;
  structure: number;
  installation: number;
  misc: number;
};

export type EstimateResponse = {
  system_size: string;
  system_size_kw: number;
  cost_breakdown: CostBreakdown;
  total_before_subsidy: number;
  subsidy: number;
  final_cost: number;
  monthly_units: number;
  state: string;
  details: Record<string, unknown>;
};

const inputClass =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-muted";

export function SolarCalculatorForm() {
  const [states, setStates] = useState<StateOpt[]>([]);
  const [districts, setDistricts] = useState<DistrictOpt[]>([]);
  const [stateId, setStateId] = useState<number | "">("");
  const [districtName, setDistrictName] = useState("");
  const [mode, setMode] = useState<"bill" | "units">("bill");
  const [monthlyBill, setMonthlyBill] = useState("");
  const [monthlyUnits, setMonthlyUnits] = useState("");
  const [rupeesPerUnit, setRupeesPerUnit] = useState("");
  const [includeBattery, setIncludeBattery] = useState(false);
  const [batteryKwh, setBatteryKwh] = useState("5");
  const [roofType, setRoofType] = useState("RCC");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveLead, setSaveLead] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedStateName = states.find((s) => s.id === stateId)?.name ?? "";

  useEffect(() => {
    jfetch<StateOpt[]>("/states", { auth: false })
      .then((rows) => {
        setStates(rows);
        if (rows.length) {
          setStateId((prev) => {
            if (prev !== "") return prev;
            const g = rows.find((s) => s.name.toLowerCase().includes("gujarat")) ?? rows[0];
            return g.id;
          });
        }
      })
      .catch(() => toast.error("Could not load states. Is the API running?"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (stateId === "") {
        await Promise.resolve();
        if (!cancelled) setDistricts([]);
        return;
      }
      try {
        const d = await jfetch<DistrictOpt[]>(`/districts?state_id=${stateId}`, { auth: false });
        if (!cancelled) setDistricts(d);
      } catch {
        if (!cancelled) setDistricts([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [stateId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    if (stateId === "") {
      setErr("Select a state.");
      return;
    }
    const bill = monthlyBill.trim() ? Number(monthlyBill) : undefined;
    const units = monthlyUnits.trim() ? Number(monthlyUnits) : undefined;
    if (mode === "bill" && (!bill || bill <= 0)) {
      setErr("Enter a monthly bill amount (₹), or switch to kWh mode.");
      return;
    }
    if (mode === "units" && (!units || units <= 0)) {
      setErr("Enter monthly units (kWh), or switch to bill mode.");
      return;
    }
    const rpu = rupeesPerUnit.trim() ? Number(rupeesPerUnit) : undefined;
    if (rpu !== undefined && (rpu < 1 || rpu > 20)) {
      setErr("₹/unit override must be between 1 and 20.");
      return;
    }

    const body: Record<string, unknown> = {
      state: selectedStateName,
      district: districtName.trim() || null,
      include_battery: includeBattery,
      battery_kwh: Number(batteryKwh) || 0,
      roof_type: roofType,
      save_lead: saveLead,
      name: name.trim() || null,
      phone: phone.trim() || null,
    };
    if (rpu !== undefined) body.rupees_per_unit = rpu;
    if (mode === "units" && units) body.monthly_units = units;
    else if (bill) body.monthly_bill = bill;

    setLoading(true);
    try {
      const res = await jfetch<EstimateResponse>("/estimate", {
        method: "POST",
        body: JSON.stringify(body),
        auth: false,
      });
      setResult(res);
      toast.success("Estimate ready");
    } catch (ex) {
      const msg = String(ex);
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
      <form onSubmit={onSubmit} className="glass-panel space-y-5 rounded-3xl p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="calc-state">
              State
            </label>
            <select
              id="calc-state"
              className={inputClass}
              value={stateId}
              onChange={(e) => {
                setStateId(e.target.value ? Number(e.target.value) : "");
                setDistrictName("");
              }}
            >
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="calc-district">
              District (optional)
            </label>
            <input
              id="calc-district"
              className={inputClass}
              list="district-options"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              placeholder="Type or pick from suggestions"
            />
            <datalist id="district-options">
              {districts.map((d) => (
                <option key={d.id} value={d.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("bill")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === "bill" ? "bg-primary text-bg" : "border border-white/15 text-muted hover:text-white"
            }`}
          >
            From monthly bill
          </button>
          <button
            type="button"
            onClick={() => setMode("units")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
              mode === "units" ? "bg-primary text-bg" : "border border-white/15 text-muted hover:text-white"
            }`}
          >
            From kWh / month
          </button>
        </div>

        {mode === "bill" ? (
          <div>
            <label className={labelClass} htmlFor="calc-bill">
              Monthly electricity bill (₹)
            </label>
            <input
              id="calc-bill"
              inputMode="decimal"
              className={inputClass}
              value={monthlyBill}
              onChange={(e) => setMonthlyBill(e.target.value)}
              placeholder="e.g. 4500"
            />
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="calc-units">
              Monthly consumption (kWh)
            </label>
            <input
              id="calc-units"
              inputMode="decimal"
              className={inputClass}
              value={monthlyUnits}
              onChange={(e) => setMonthlyUnits(e.target.value)}
              placeholder="e.g. 450"
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="calc-rpu">
            ₹ per unit override (optional, 1–20)
          </label>
          <input
            id="calc-rpu"
            inputMode="decimal"
            className={inputClass}
            value={rupeesPerUnit}
            onChange={(e) => setRupeesPerUnit(e.target.value)}
            placeholder="Leave blank to use system default"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="calc-roof">
              Roof type
            </label>
            <select id="calc-roof" className={inputClass} value={roofType} onChange={(e) => setRoofType(e.target.value)}>
              <option value="RCC">RCC</option>
              <option value="METAL">Metal</option>
              <option value="GROUND">Ground</option>
            </select>
          </div>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/90">
              <input
                type="checkbox"
                checked={includeBattery}
                onChange={(e) => setIncludeBattery(e.target.checked)}
                className="h-4 w-4 rounded border-white/20"
              />
              Include battery
            </label>
            {includeBattery ? (
              <div>
                <label className={labelClass} htmlFor="calc-batt">
                  Battery size (kWh)
                </label>
                <input
                  id="calc-batt"
                  inputMode="decimal"
                  className={inputClass}
                  value={batteryKwh}
                  onChange={(e) => setBatteryKwh(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="calc-name">
              Name (optional)
            </label>
            <input id="calc-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="calc-phone">
              Phone (optional)
            </label>
            <input id="calc-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={saveLead}
            onChange={(e) => setSaveLead(e.target.checked)}
            className="h-4 w-4 rounded border-white/20"
          />
          Save this estimate as a lead (recommended)
        </label>

        {err ? <p className="text-sm text-accent">{err}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring w-full rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg disabled:opacity-50"
        >
          {loading ? "Calculating…" : "Calculate estimate"}
        </button>
      </form>

      <div className="space-y-6">
        {result ? (
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <h3 className="font-display text-xl font-bold text-white">Your indicative system</h3>
            <p className="mt-1 text-sm text-muted">
              {result.system_size} · ~{result.monthly_units.toFixed(0)} kWh/mo modelled · {result.state}
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              {(
                [
                  ["Panels", result.cost_breakdown.panels],
                  ["Inverter", result.cost_breakdown.inverter],
                  ["Battery", result.cost_breakdown.battery],
                  ["Structure", result.cost_breakdown.structure],
                  ["Installation", result.cost_breakdown.installation],
                  ["Misc", result.cost_breakdown.misc],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-mono text-white">₹{v.toLocaleString("en-IN")}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-2 font-semibold">
                <dt className="text-white">Before subsidy</dt>
                <dd className="font-mono text-primary">₹{result.total_before_subsidy.toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Subsidy</dt>
                <dd className="font-mono text-white">− ₹{result.subsidy.toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-4 text-lg font-bold">
                <dt className="text-white">Estimated payable</dt>
                <dd className="font-mono text-gradient-brand">₹{result.final_cost.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
            <p className="mt-6 text-xs text-muted">
              Indicative only — final BOQ depends on site survey, structure, and DISCOM. Subsidy rules change; we validate
              at booking time.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm text-muted">
            Run the calculator to see system size, cost breakdown, and subsidy offset.
          </div>
        )}
      </div>
    </div>
  );
}
