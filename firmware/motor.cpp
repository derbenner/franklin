#include "firmware.h"

void Motor::load (int16_t &addr, bool eeprom)
{
	step_pin = read_8 (addr, eeprom);
	dir_pin = read_8 (addr, eeprom);
	enable_pin = read_8 (addr, eeprom);
	steps_per_mm = read_float (addr, eeprom);
	max_v_neg = read_float (addr, eeprom);
	max_v_pos = read_float (addr, eeprom);
	max_a = read_float (addr, eeprom);
	SET_OUTPUT (step_pin);
	SET_OUTPUT (dir_pin);
	SET_OUTPUT (enable_pin);
	SET (enable_pin);
}

void Motor::save (int16_t &addr, bool eeprom)
{
	write_8 (addr, step_pin, eeprom);
	write_8 (addr, dir_pin, eeprom);
	write_8 (addr, enable_pin, eeprom);
	write_float (addr, steps_per_mm, eeprom);
	write_float (addr, max_v_neg, eeprom);
	write_float (addr, max_v_pos, eeprom);
	write_float (addr, max_a, eeprom);
}
