import io
from datetime import datetime, timezone

from fpdf import FPDF

from app.schemas.estimate import EstimateRequest, EstimateResponse


def render_estimate_pdf(req: EstimateRequest, res: EstimateResponse) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Solar system estimate", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(0, 6, f"Generated: {datetime.now(timezone.utc).isoformat()}", ln=True)
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, "Summary", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"State: {res.state}", ln=True)
    if req.district:
        pdf.cell(0, 6, f"District: {req.district}", ln=True)
    pdf.cell(0, 6, f"Proposed size: {res.system_size}", ln=True)
    pdf.cell(0, 6, f"Est. monthly units: {res.monthly_units} kWh", ln=True)
    pdf.ln(2)
    b = res.cost_breakdown
    parts = [
        ("Panels", b.panels),
        ("Inverter", b.inverter),
        ("Battery", b.battery),
        ("Structure", b.structure),
        ("Installation", b.installation),
        ("Misc", b.misc),
    ]
    for label, val in parts:
        pdf.cell(0, 6, f"{label}: Rs {val:,}", ln=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, f"Subtotal (pre-subsidy): Rs {res.total_before_subsidy:,}", ln=True)
    pdf.cell(0, 6, f"Subsidy: Rs {res.subsidy:,}", ln=True)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Indicative final: Rs {res.final_cost:,}", ln=True)
    out = io.BytesIO()
    pdf_bytes = pdf.output()  # type: ignore[assignment]
    if isinstance(pdf_bytes, str):
        out.write(pdf_bytes.encode("latin-1"))
    else:
        out.write(bytes(pdf_bytes))
    return out.getvalue()
