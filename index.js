const express = require('express');
const cors = require('cors');
require("colors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());


// MongoDB


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mogodb-practice.uoisaxb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// API
app.get("/", (req, res) => {
    res.send("Doctors Portal Server Is Running...")
})


async function dataBase() {
    try {

        const appointmentOptionsCollection = client.db("doctors-portal").collection("appointmentOptions");
        const bookingsCollection = client.db("doctors-portal").collection("bookings");


        // All Appointment Option 
        app.get("/appointmentOptions", async (req, res) => {
            const query = {};
            const date = req.query.date;
            const appointmentOptions = await appointmentOptionsCollection.find(query).toArray();

            const bookingQuery = {
                date: date
            }

            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            appointmentOptions.forEach(appointmentOption => {
                const optionBooked = alreadyBooked.filter(booked => booked.treatmentName === appointmentOption.name);
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = appointmentOption.slots.filter(slot => !bookedSlots.includes(slot));
                appointmentOption.slots = remainingSlots;
            })
            res.send(appointmentOptions)
        })

        // Add Booking To Database
        app.post("/booking", async (req, res) => {
            const booking = req.body;

            const query = {
                date: booking.date
            }

            const booked = await bookingsCollection.find(query).toArray();

            if (booked.length) {
                const message = `You already have a booking on ${booking?.date}`;
                return res.send({ acknowledge: false, message })
            }


            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        })



    }
    catch (err) {
        console.log(err.message.bgRed.bold)
        console.log(err.stack.bgBlue.bold)
    }
}

dataBase().catch(err => console.log(err.bold.bgRed))





// Listen
app.listen(port, () => {
    console.log(`Server Is Running On ${port}`.bgRed.bold);
})

