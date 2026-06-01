const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

// app.use(cors());
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);
app.use(express.json());

const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("StudyNookDb");
    const roomCollection = db.collection("allRooms");
    const bookingCollection = db.collection("bookings");
    // get data----------------------------------------------------------------------------------------
    app.get("/rooms", async (req, res) => {
      const result = await roomCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });
    app.get("/rooms/latest", async (req, res) => {
      const result = await roomCollection
        .find()
        .sort({ _id: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });
    app.get("/rooms/:id", async (req, res) => {
      const { id } = req.params;

      const result = await roomCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });
    app.get("/my-rooms/:email", async (req, res) => {
      const email = req.params.email;

      const result = await roomCollection
        .find({ userEmail: email })
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const result = await bookingCollection
        .find({ userEmail: email })
        .sort({ _id: -1 })
        .toArray();
      res.json(result);
    });

    app.get("/bookings", async (req, res) => {
      const result = await bookingCollections
        .find()
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });
    // searching -----------------------------
    app.get("/api/rooms", async (req, res) => {
      try {
        const { search, amenities, minRate, maxRate, floor } = req.query;

        let query = {};

        if (search) {
          query.roomName = {
            $regex: search,
            $options: "i",
          };
        }

        if (amenities) {
          const amenitiesArray = amenities.split(",").map((a) => a.trim());
          query.amenities = { $in: amenitiesArray };
        }

        if (minRate || maxRate) {
          query.hourlyRate = {};
          if (minRate) query.hourlyRate.$gte = Number(minRate);
          if (maxRate) query.hourlyRate.$lte = Number(maxRate);
        }

        if (floor) {
          query.floor = floor;
        }

        const rooms = await roomCollection.find(query).toArray();
        res.json(rooms);
      } catch (err) {
        console.error("Error fetching rooms:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // post  data-------------------------------------------------------------
    app.post("/rooms", async (req, res) => {
      const room = req.body;

      const result = await roomCollection.insertOne(room);

      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const {
        roomId,
        date,
        startTime,
        endTime,
        totalCost,
        specialNote,
        userEmail,
        userName,
        roomName,
        image,
      } = req.body;

      const conflict = await bookingCollection.findOne({
        roomId,
        date,
        $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
      });

      if (conflict) {
        return res
          .status(409)
          .json({ message: "This time slot is already booked!" });
      }

      const booking = {
        roomId,
        roomName,
        date,
        image,
        startTime,
        endTime,
        totalCost,
        specialNote,
        userEmail,
        userName,
        status: "confirmed",
        createdAt: new Date(),
      };

      const result = await bookingCollection.insertOne(booking);

      // bookingCount increment------
      await roomCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $inc: { bookingCount: 1 } },
      );

      res.status(201).json(result);
    });
    //update room -------------------------------------------------------
    app.patch("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      // console.log(updatedData);

      const result = await roomCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );

      res.json(result);
    });
    // booking cencel----------------------------------------
    // Cancel booking
    app.patch("/bookings/:id/cancel", async (req, res) => {
      const { id } = req.params;
      const { userEmail } = req.body;

      const booking = await bookingCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // verify booking belongs to this user
      if (booking.userEmail !== userEmail) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await bookingCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "cancelled" } },
      );

      // optional — bookingCount কমাও
      await roomCollection.updateOne(
        { _id: new ObjectId(booking.roomId) },
        { $inc: { bookingCount: -1 } },
      );

      res.json({ message: "Booking cancelled successfully" });
    });
    //delete room-----------------------------------------------------------------------
    app.delete("/rooms/:id", async (req, res) => {
      const { id } = req.params;

      // example: MongoDB collection
      const result = await roomCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });
    app.delete("/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("My studyNook server is running");
});

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
}

module.exports = app;
