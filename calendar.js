async function buildCalendar(){

    const roomsResponse =
        await fetchRooms();

    const selectedProperty =
        document.getElementById(
            "propertySelect"
        ).value;

    const rooms =
    (roomsResponse.rooms || [])
    .filter(
        room =>
            room.propertyId === selectedProperty
    );

console.log("ROOMS", rooms);

    const board =
        document.getElementById(
            "calendarBoard"
        );

    if(!board) return;

    board.innerHTML = "";

    const days = 30;

    const calendar =
        document.createElement("div");

    calendar.className =
        "availability-calendar";

    let header =
        `<div class="calendar-row header-row">
            <div class="room-column">
                Room
            </div>`;

    for(let day = 1; day <= days; day++){

        header += `
            <div class="day-cell">
                ${day}
            </div>
        `;

    }

    header += "</div>";

    calendar.innerHTML = header;

    rooms.forEach(room => {

        let row =
        `<div class="calendar-row">

            <div class="room-column">
                ${room.roomName}
            </div>`;

        for(let day = 1; day <= days; day++){

            row +=
            `<div class="day-cell available"></div>`;

        }

        row += "</div>";

        calendar.innerHTML += row;

    });

    board.appendChild(calendar);

}
