import csv
import io
from datetime import datetime, timezone

from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import tables as T


async def streaming_leads_csv(session: AsyncSession) -> StreamingResponse:
    r = await session.execute(
        select(T.Lead).order_by(T.Lead.created_at.desc())
    )
    rows = r.scalars().all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "id",
            "name",
            "phone",
            "state",
            "district",
            "system_size",
            "system_size_kw",
            "estimated_cost",
            "monthly_bill",
            "units",
            "roof_type",
            "created_at",
        ]
    )
    for lead in rows:
        w.writerow(
            [
                lead.id,
                lead.name,
                lead.phone,
                lead.state,
                lead.district,
                lead.system_size,
                lead.system_size_kw,
                lead.estimated_cost,
                lead.monthly_bill,
                lead.units_consumed,
                lead.roof_type,
                lead.created_at.isoformat() if lead.created_at else "",
            ]
        )
    data = buf.getvalue().encode("utf-8-sig")
    name = f"leads_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.csv"
    return StreamingResponse(
        iter([data]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
