document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

async function initializeApp(){

    try{

        await buildCalendar();

    }
    catch(error){

        console.error(error);

    }

}
