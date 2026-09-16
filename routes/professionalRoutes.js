const express = require("express");

const protect = require("../middleware/auth");

const {
  getProfessionalDashboard,
} = require("../controllers/professionalController");

const router = express.Router();

router.get(
  "/dashboard",
  protect,
  getProfessionalDashboard
);

module.exports = router;