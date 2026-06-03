document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

async function initializeApp(){

    try{

        await loadProperties();

        await updateDashboard();

        await buildCalendar();

        document
            .getElementById("propertySelect")
            .addEventListener(
                "change",
                async () => {

                    await updateDashboard();

                    await buildCalendar();

                }
            );

    }
    catch(error){

        console.error(
            "Initialization Error:",
            error
        );

    }

}

async function updateDashboard(){

    const selectedProperty =
        document.getElementById(
            "propertySelect"
        ).value;

    const roomsResponse =
        await fetchRooms();

    const bookingsResponse =
        await fetchBookings();

    const rooms =
        (roomsResponse.rooms || [])
        .filter(
            room =>
                room.propertyId ===
                selectedProperty
        );

    const roomIds =
        rooms.map(
            room => room.roomId
        );

    const bookings =
        (bookingsResponse.bookings || [])
        .filter(
            booking =>
                roomIds.includes(
                    booking.roomId
                )
        );

    const confirmed =
        bookings.filter(
            booking =>
                booking.status ===
                "CONFIRMED"
        ).length;

    const holds =
        bookings.filter(
            booking =>
                booking.status ===
                "HOLD"
        ).length;

    const occupied =
        confirmed + holds;

    const available =
        Math.max(
            rooms.length - occupied,
            0
        );

    const occupancy =
        rooms.length
            ? Math.round(
                (occupied / rooms.length) * 100
              )
            : 0;

    document.getElementById(
        "availableRooms"
    ).textContent =
        available;

    document.getElementById(
        "activeHolds"
    ).textContent =
        holds;

    document.getElementById(
        "confirmedBookings"
    ).textContent =
        confirmed;

    document.getElementById(
        "occupancyRate"
    ).textContent =
        occupancy + "%";

}

async function loadProperties(){

    const response =
        await fetchProperties();

    const properties =
        response.properties || [];

    const select =
        document.getElementById(
            "propertySelect"
        );

    if(!select) return;

    select.innerHTML = "";

    properties.forEach(property => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            property.propertyId;

        option.textContent =
            property.propertyName;

        select.appendChild(
            option
        );

    });

}
