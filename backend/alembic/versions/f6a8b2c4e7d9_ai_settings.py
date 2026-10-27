"""site_settings AI provider settings (key stored encrypted)

Revision ID: f6a8b2c4e7d9
Revises: e5f7a1b3d6c8
Create Date: 2026-10-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a8b2c4e7d9"
down_revision: Union[str, None] = "e5f7a1b3d6c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.add_column(sa.Column("ai_provider", sa.String(20), nullable=False, server_default=""))
        batch.add_column(sa.Column("ai_model", sa.String(100), nullable=False, server_default=""))
        batch.add_column(sa.Column("ai_base_url", sa.String(300), nullable=False, server_default=""))
        batch.add_column(sa.Column("ai_key_enc", sa.Text(), nullable=False, server_default=""))
        batch.add_column(sa.Column("ai_daily_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("ai_daily_limit")
        batch.drop_column("ai_key_enc")
        batch.drop_column("ai_base_url")
        batch.drop_column("ai_provider")
        batch.drop_column("ai_model")
