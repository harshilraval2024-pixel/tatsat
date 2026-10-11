"""site_settings.theme (dark | light)

Revision ID: d4e6f0a2c5b7
Revises: c3d5e9f1b4a6
Create Date: 2026-10-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e6f0a2c5b7"
down_revision: Union[str, None] = "c3d5e9f1b4a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.add_column(
            sa.Column("theme", sa.String(20), nullable=False, server_default="dark")
        )


def downgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("theme")
