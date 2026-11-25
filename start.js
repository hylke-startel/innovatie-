// Startlaag voor Railway. Byte staat in de map byte/, maar Railway bouwt vanuit de root.
// Dit bestand start byte/server.js en houdt de gegevensmap op /app/data (zoals in byte/LEESMIJ.md),
// zodat een Railway-volume op /app/data gewoon werkt.
const path = require("path");
if (!process.env.DATA_DIR) process.env.DATA_DIR = path.join(__dirname, "data");
require("./byte/server.js");
