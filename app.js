document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

async function initializeApp(){

    try{

        const properties =
            await fetchProperties();

        const rooms =
            await fetchRooms();

        const bookings =
            await fetchBookings();

        console.log(
            "Properties",
            properties
        );

        console.log(
            "Rooms",
            rooms
        );

        console.log(
            "Bookings",
            bookings
        );

    }
    catch(error){

        console.error(error);

    }

}
