document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

async function initializeApp(){

   try{

    await updateDashboard();

    await buildCalendar();

 }
    catch(error){

        console.error(error);

    }

}
    
async function updateDashboard(){

    const roomsResponse =
        await fetchRooms();

    const bookingsResponse =
        await fetchBookings();

    const rooms =
        roomsResponse.rooms || [];

    const bookings =
        bookingsResponse.bookings || [];

    const confirmed =
        bookings.filter(
            b => b.Status === "CONFIRMED"
        ).length;

    const holds =
        bookings.filter(
            b => b.Status === "HOLD"
        ).length;

    const occupied =
        confirmed + holds;

    const available =
        rooms.length - occupied;

    const occupancy =
        rooms.length
        ? Math.round(
            (occupied / rooms.length) * 100
          )
        : 0;

    document.getElementById(
        "availableRooms"
    ).textContent = available;

    document.getElementById(
        "activeHolds"
    ).textContent = holds;

    document.getElementById(
        "confirmedBookings"
    ).textContent = confirmed;

    document.getElementById(
        "occupancyRate"
    ).textContent = occupancy + "%";

}
