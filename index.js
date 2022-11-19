const express = require('express');
const cors = require('cors');
require("colors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
            return res.status(403).send({ message: "Forbidden" })
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
        const doctorsCollection = client.db("doctors-portal").collection("doctors");


        // Verify Admin Middleware

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const stepTakenUser = await usersCollection.findOne(query);
            if (stepTakenUser?.role !== "Admin") {
                return res.status(403).send({ message: "You Can't Take Action." })
            }
            next();
        }


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
                date: booking.date,
                treatmentName: booking.treatmentName,
                email: booking.email
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


        // Specific Users Remove Booking
        app.delete("/delete/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }

            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })


        // JWT
        app.get("/jwt", async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "24h" })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ message: "Forbidden" })
        })


        // Load Specific User By Email
        app.get("/user/admin/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === "Admin" })
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


        // Change User Role
        app.put("/user/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: "Admin"
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })


        // Only Treatment Name
        app.get("/appointment-name", verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray();
            res.send(result)
        })


        // Add Doctor To DB
        app.post("/add-doctor", verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result)
        })

        // Send All Doctors
        app.get("/doctors", verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const doctors = await doctorsCollection.find(query).toArray();
            res.send(doctors);
        })

        // Delete A Doctor By ID
        app.delete("/delete-doctors/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        });


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

