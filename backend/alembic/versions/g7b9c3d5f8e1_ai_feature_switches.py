"""site_settings AI feature switches (chat, bill reader) - default off

Revision ID: g7b9c3d5f8e1
Revises: f6a8b2c4e7d9
Create Date: 2026-10-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7b9c3d5f8e1"
down_revision: Union[str, None] = "f6a8b2c4e7d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.add_column(sa.Column("ai_chat_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("ai_bill_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("ai_bill_enabled")
        batch.drop_column("ai_chat_enabled")
