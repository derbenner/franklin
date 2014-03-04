#include "firmware.h"

void Constants::load (int16_t &addr, bool eeprom)
{
	// This function must not be called.
	debug ("Constants::load must not be called!");
}

void Constants::save (int16_t &addr, bool eeprom)
{
	// This should never be called with eeprom true, but if it is, don't write to eeprom anyway.
	write_8 (addr, NAMELEN, false);
	write_8 (addr, MAXAXES, false);
	write_8 (addr, MAXEXTRUDERS, false);
	write_8 (addr, MAXTEMPS, false);
	write_8 (addr, MAXGPIOS, false);
#ifndef LOWMEM
	write_16 (addr, MAXDISPLACEMENTS, false);
#else
	write_16 (addr, 0, false);
#endif
#ifdef AUDIO
	write_8 (addr, AUDIO_FRAGMENTS, false);
	write_8 (addr, AUDIO_FRAGMENT_SIZE, false);
#else
	write_8 (addr, 0, false);
	write_8 (addr, 0, false);
#endif
	write_8 (addr, NUM_DIGITAL_PINS + NUM_ANALOG_INPUTS, false);
	write_8 (addr, NUM_DIGITAL_PINS, false);
}

void Variables::load (int16_t &addr, bool eeprom)
{
	uint8_t type = printer_type;
	for (uint8_t i = 0; i < NAMELEN; ++i)
		name[i] = read_8 (addr, eeprom);
	num_axes = read_8 (addr, eeprom);
	num_axes = min (num_axes, MAXAXES);
	num_extruders = read_8 (addr, eeprom);
	num_extruders = min (num_extruders, MAXEXTRUDERS);
	num_temps = read_8 (addr, eeprom);
	num_temps = min (num_temps, MAXTEMPS);
	num_gpios = read_8 (addr, eeprom);
	num_gpios = min (num_gpios, MAXGPIOS);
	printer_type = read_8 (addr, eeprom);
	printer_type = min (printer_type, 1);
	led_pin.read (read_16 (addr, eeprom));
#ifndef LOWMEM
	room_T = read_float (addr, eeprom) + 273.15;
#else
	read_float (addr, eeprom);	// Discard value.
#endif
	motor_limit = read_32 (addr, eeprom);
	temp_limit = read_32 (addr, eeprom);
	feedrate = read_float (addr, eeprom);
	SET_OUTPUT (led_pin);
	if (type != printer_type)
		axis[0].source = NAN;
}

void Variables::save (int16_t &addr, bool eeprom)
{
	for (uint8_t i = 0; i < NAMELEN; ++i)
		write_8 (addr, name[i], eeprom);
	write_8 (addr, num_axes, eeprom);
	write_8 (addr, num_extruders, eeprom);
	write_8 (addr, num_temps, eeprom);
	write_8 (addr, num_gpios, eeprom);
	write_8 (addr, printer_type, eeprom);
	write_16 (addr, led_pin.write (), eeprom);
#ifndef LOWMEM
	write_float (addr, room_T - 273.15, eeprom);
#else
	write_float (addr, NAN, eeprom);
#endif
	write_32 (addr, motor_limit, eeprom);
	write_32 (addr, temp_limit, eeprom);
	write_float (addr, feedrate, eeprom);
}
