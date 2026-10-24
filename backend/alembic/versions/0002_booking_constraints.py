"""Add booking safeguards.

Revision ID: 0002_booking_constraints
Revises: 0001_initial_schema
"""
from alembic import op

revision = "0002_booking_constraints"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

def upgrade():
    op.create_check_constraint("room_capacity_positive", "rooms", "capacity > 0")
    op.create_check_constraint("room_type_valid", "rooms", "type IN ('meeting_room', 'workspace')")
    op.create_check_constraint("booking_times_valid", "bookings", "start_time < end_time")
    op.create_check_constraint("booking_status_valid", "bookings", "status IN ('confirmed', 'cancelled')")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute("""ALTER TABLE bookings ADD CONSTRAINT no_overlapping_confirmed_bookings
        EXCLUDE USING gist (room_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
        WHERE (status = 'confirmed')""")

def downgrade():
    op.execute("ALTER TABLE bookings DROP CONSTRAINT no_overlapping_confirmed_bookings")
    op.drop_constraint("booking_status_valid", "bookings", type_="check")
    op.drop_constraint("booking_times_valid", "bookings", type_="check")
    op.drop_constraint("room_type_valid", "rooms", type_="check")
    op.drop_constraint("room_capacity_positive", "rooms", type_="check")
