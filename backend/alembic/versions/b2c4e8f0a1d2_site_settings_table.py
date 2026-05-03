"""site_settings table

Revision ID: b2c4e8f0a1d2
Revises: ada17f761693
Create Date: 2026-04-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c4e8f0a1d2"
down_revision: Union[str, None] = "ada17f761693"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("tagline", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("public_url", sa.String(length=500), nullable=False),
        sa.Column("phone_display", sa.String(length=80), nullable=False),
        sa.Column("phone_tel", sa.String(length=40), nullable=False),
        sa.Column("whatsapp_digits", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("hours", sa.String(length=300), nullable=False),
        sa.Column("address_line1", sa.String(length=200), nullable=False),
        sa.Column("address_line2", sa.String(length=200), nullable=False),
        sa.Column("address_city", sa.String(length=120), nullable=False),
        sa.Column("address_state", sa.String(length=120), nullable=False),
        sa.Column("address_pin", sa.String(length=20), nullable=False),
        sa.Column("address_country", sa.String(length=120), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("site_settings")
