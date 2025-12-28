const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const city = req.query.city;

    if (!city) {
      return res.status(400).json({ ok: false, error: "City is required" });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

    const response = await axios.get(url);
    const data = response.data;

    res.json({
      ok: true,
      city: data.name,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      wind: data.wind.speed,
      icon: data.weather[0].icon
    });

  } catch (err) {
    res.status(500).json({ ok: false, error: "Weather fetch failed" });
  }
});

module.exports = router;
