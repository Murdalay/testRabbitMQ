var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Article

var Lottery = new Schema({
	draw_date: { type: String, required: true },
	winning_numbers: { type: String, required: true },
	multiplier: { type: String, required: true }
});


module.exports = mongoose.model('Lottery', Lottery);