const express = require('express');
const cors = require('cors');
require("colors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
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



function verifyJWT(req, res, next) {
    // const token = req.headers.authorization;
    // console.log(token);
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send("UnAuthorized Access")
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: "Forbidden" })
        }
        req.decoded = decoded;
        next();
    })
}


async function dataBase() {
    try {

        const appointmentOptionsCollection = client.db("doctors-portal").collection("appointmentOptions");
        const bookingsCollection = client.db("doctors-portal").collection("bookings");
        const usersCollection = client.db("doctors-portal").collection("users");


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

        // Specific User Booking By Their Email
        app.get("/myappointments", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: "Forbidden" })
            }
            const query = {
                email: email
            }
            const booking = await bookingsCollection.find(query).toArray();
            res.send(booking);
        })


        // JWT
        app.get("/jwt", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "24h" })
                res.send({ accessToken: token })
            }
            res.status(403).send({ message: "Forbidden" })
        })


        // Store Users In DataBase
        app.post("/user", async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })



        // All Users Send
        app.get("/allusers", async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
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

