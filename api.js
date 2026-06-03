const API_URL =
"https://script.google.com/macros/s/AKfycby-DnUaVH3zQixUQlQFn7Xtd9gl3Lb_o4UqANq1GMo4EfzbPxdO8fAYbyhP1xxIybc5/exec";

async function fetchProperties() {

    const response =
        await fetch(
            `${API_URL}?action=properties`
        );

    return await response.json();

}

async function fetchRooms() {

    const response =
        await fetch(
            `${API_URL}?action=rooms`
        );

    return await response.json();

}

async function fetchBookings() {

    const response =
        await fetch(
            `${API_URL}?action=bookings`
        );

    return await response.json();

}
