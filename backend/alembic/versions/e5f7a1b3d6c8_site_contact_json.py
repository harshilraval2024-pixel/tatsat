"""site_settings.contact_json (editable contact page + WhatsApp card)

Revision ID: e5f7a1b3d6c8
Revises: d4e6f0a2c5b7
Create Date: 2026-10-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f7a1b3d6c8"
down_revision: Union[str, None] = "d4e6f0a2c5b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.add_column(
            sa.Column("contact_json", sa.Text(), nullable=False, server_default="{}")
        )


def downgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("contact_json")
