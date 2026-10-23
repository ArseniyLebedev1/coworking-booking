
import uuid

from sqlalchemy import select

from app.database import SessionLocal
from app.models import (
    Amenity,
    Location,
    Role,
    Room,
    RoomAmenity,
)


def seed_database() -> None:
    with SessionLocal.begin() as db:
        roles = {
            "guest": "Гость платформы",
            "employee": "Сотрудник",
            "admin": "Администратор",
        }

        for name, description in roles.items():
            existing = db.scalar(
                select(Role).where(Role.name == name)
            )

            if existing is None:
                db.add(
                    Role(
                        id=uuid.uuid4(),
                        name=name,
                        description=description,
                    )
                )

        amenities_data = [
            ("Wi-Fi", "Беспроводной интернет"),
            ("Проектор", "Проектор для презентаций"),
            ("Кондиционер", "Климат-контроль"),
            ("Доска", "Маркерная доска"),
        ]

        amenities = {}

        for name, description in amenities_data:
            amenity = db.scalar(
                select(Amenity).where(Amenity.name == name)
            )

            if amenity is None:
                amenity = Amenity(
                    id=uuid.uuid4(),
                    name=name,
                    description=description,
                )
                db.add(amenity)

            amenities[name] = amenity

        db.flush()

        locations_data = [
            {
                "name": "Москва-Сити",
                "address": "Пресненская набережная, 12",
                "city": "Москва",
                "description": "Современный деловой коворкинг",
            },
            {
                "name": "Технопарк",
                "address": "Технологическая улица, 5",
                "city": "Москва",
                "description": "Пространство для командной работы",
            },
        ]

        locations = {}

        for data in locations_data:
            location = db.scalar(
                select(Location).where(
                    Location.name == data["name"],
                    Location.city == data["city"],
                )
            )

            if location is None:
                location = Location(
                    id=uuid.uuid4(),
                    **data,
                )
                db.add(location)

            locations[data["name"]] = location

        db.flush()

        rooms_data = [
            {
                "location": "Москва-Сити",
                "name": "Переговорная Атлас",
                "type": "meeting_room",
                "capacity": 8,
                "amenities": ["Wi-Fi", "Проектор", "Доска"],
            },
            {
                "location": "Технопарк",
                "name": "Переговорная Орбита",
                "type": "meeting_room",
                "capacity": 6,
                "amenities": ["Wi-Fi", "Кондиционер"],
            },
            {
                "location": "Москва-Сити",
                "name": "Рабочее место Фокус",
                "type": "workspace",
                "capacity": 1,
                "amenities": ["Wi-Fi"],
            },
        ]

        for data in rooms_data:
            location = locations[data["location"]]

            room = db.scalar(
                select(Room).where(
                    Room.location_id == location.id,
                    Room.name == data["name"],
                )
            )

            if room is None:
                room = Room(
                    id=uuid.uuid4(),
                    location_id=location.id,
                    name=data["name"],
                    type=data["type"],
                    capacity=data["capacity"],
                    is_active=True,
                )
                db.add(room)
                db.flush()

            for amenity_name in data["amenities"]:
                amenity = amenities[amenity_name]

                existing_link = db.scalar(
                    select(RoomAmenity).where(
                        RoomAmenity.room_id == room.id,
                        RoomAmenity.amenity_id == amenity.id,
                    )
                )

                if existing_link is None:
                    db.add(
                        RoomAmenity(
                            room_id=room.id,
                            amenity_id=amenity.id,
                        )
                    )


if __name__ == "__main__":
    seed_database()
    print("Seed-данные успешно добавлены")
