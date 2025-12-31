// routes/market.js - Stock Market API
const express = require('express');
const router = express.Router();

// Simulated stock data (replace with real API like Alpha Vantage or Yahoo Finance)
router.get('/', async (req, res) => {
    try {
        // In production, fetch from a real stock API
        // For now, using simulated data with slight randomization
        const baseStocks = [
            { symbol: "RELIANCE", basePrice: 2847.50 },
            { symbol: "TCS", basePrice: 4123.25 },
            { symbol: "HDFC BANK", basePrice: 1645.75 },
            { symbol: "INFOSYS", basePrice: 1856.30 },
            { symbol: "ICICI BANK", basePrice: 1234.50 },
            { symbol: "BHARTI AIRTEL", basePrice: 1567.80 }
        ];

        const stocks = baseStocks.map(stock => {
            // Add random fluctuation (-3% to +3%)
            const changePercent = (Math.random() * 6 - 3).toFixed(2);
            const price = (stock.basePrice * (1 + parseFloat(changePercent) / 100)).toFixed(2);

            return {
                symbol: stock.symbol,
                price: parseFloat(price),
                change: parseFloat(changePercent)
            };
        });

        res.json({
            ok: true,
            data: stocks,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error('Market API error:', err);
        res.status(500).json({ ok: false, error: 'Failed to fetch market data' });
    }
});

module.exports = router;
