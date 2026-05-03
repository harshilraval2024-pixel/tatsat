"""cms projects, services, extended site_settings

Revision ID: c3d5e9f1b4a6
Revises: b2c4e8f0a1d2
Create Date: 2026-05-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d5e9f1b4a6"
down_revision: Union[str, None] = "b2c4e8f0a1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("site_settings") as batch:
        batch.add_column(
            sa.Column("hero_headline", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("hero_subtitle", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column(
                "hero_cta_primary_label",
                sa.String(80),
                nullable=False,
                server_default="Get free quote",
            )
        )
        batch.add_column(
            sa.Column(
                "hero_cta_primary_href",
                sa.String(500),
                nullable=False,
                server_default="/quote",
            )
        )
        batch.add_column(
            sa.Column("hero_cta_secondary_label", sa.String(80), nullable=True)
        )
        batch.add_column(
            sa.Column("hero_footer_line", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("map_embed_url", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("service_areas", sa.Text(), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("social_facebook", sa.String(500), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("social_instagram", sa.String(500), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("social_linkedin", sa.String(500), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column("social_youtube", sa.String(500), nullable=False, server_default="")
        )

    op.create_table(
        "cms_projects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("location", sa.String(200), nullable=False, server_default=""),
        sa.Column("system_size_kw", sa.Float(), nullable=False, server_default="0"),
        sa.Column("completion_date", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cms_project_images",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("cms_projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("alt_text", sa.String(300), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cms_project_images_project_id",
        "cms_project_images",
        ["project_id"],
    )

    op.create_table(
        "cms_services",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon_name", sa.String(40), nullable=False, server_default="home"),
        sa.Column("price_label", sa.String(120), nullable=True),
        sa.Column("benefits_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_cms_services_slug"),
    )


def downgrade() -> None:
    op.drop_table("cms_services")
    op.drop_index("ix_cms_project_images_project_id", table_name="cms_project_images")
    op.drop_table("cms_project_images")
    op.drop_table("cms_projects")
    with op.batch_alter_table("site_settings") as batch:
        batch.drop_column("social_youtube")
        batch.drop_column("social_linkedin")
        batch.drop_column("social_instagram")
        batch.drop_column("social_facebook")
        batch.drop_column("service_areas")
        batch.drop_column("map_embed_url")
        batch.drop_column("hero_footer_line")
        batch.drop_column("hero_cta_secondary_label")
        batch.drop_column("hero_cta_primary_href")
        batch.drop_column("hero_cta_primary_label")
        batch.drop_column("hero_subtitle")
        batch.drop_column("hero_headline")
