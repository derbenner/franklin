#include "firmware.h"

void setup ()
{
	// Initialize volatile variables.
	Serial.begin (115200);
	command_end = 0;
	motors_busy = false;
	queue_start = 0;
	queue_end = 0;
	num_movecbs = 0;
	continue_cb = 0;
	which_tempcbs = 0;
	have_msg = false;
	pause_all = false;
	last_packet = NULL;
	out_busy = false;
	reply_ready = false;
	led_phase = 0;
	temps_busy = 0;
	led_last = millis ();
	last_active = millis ();
	v0 = 0;
	vp = 0;
	vq = 0;
	t0 = 0;
	tq = 0;
	f0 = 0;
	moving = false;
	move_prepared = false;
	current_move_has_cb = false;
	audio_head = 0;
	audio_tail = 0;
	audio_state = 0;
	audio_us_per_bit = 125; // 1000000 / 8000;
	// Prepare asynchronous command buffers.
	limitcb_buffer[0] = 7;
	limitcb_buffer[1] = CMD_LIMIT;
	limitcb_buffer[2] = 0;
	limitcb_buffer[3] = 0;
	limitcb_buffer[4] = 0;
	limitcb_buffer[5] = 0;
	limitcb_buffer[6] = 0;
	movecb_buffer[0] = 3;
	movecb_buffer[1] = CMD_MOVECB;
	movecb_buffer[2] = 0;
	tempcb_buffer[0] = 3;
	tempcb_buffer[1] = CMD_TEMPCB;
	continue_buffer[0] = 3;
	continue_buffer[1] = CMD_CONTINUE;
	continue_buffer[2] = 0;
	sense_buffer[0] = 7;
	sense_buffer[1] = CMD_SENSE;
	sense_buffer[2] = 0;
	sense_buffer[3] = 0;
	sense_buffer[4] = 0;
	sense_buffer[5] = 0;
	sense_buffer[6] = 0;
	motors[F0] = NULL;
	temps[F0] = NULL;
	objects[F0] = &constants;
	motors[F1] = NULL;
	temps[F1] = NULL;
	objects[F1] = &variables;
	uint8_t i = 2;
	for (uint8_t a = 0; a < MAXAXES; ++a, ++i)
	{
		motors[i] = &axis[a].motor;
		temps[i] = NULL;
		objects[i] = &axis[a];
		limits_pos[a] = NAN;
		axis[a].current_pos = 0;
		axis[a].source = NAN;
		axis[a].sense_state = 0;
		axis[a].sense_pos = MAXLONG;
		axis[a].limit_min_pin.read (0x100);
		axis[a].limit_max_pin.read (0x100);
		axis[a].sense_pin.read (0x100);
	}
	for (uint8_t e = 0; e < MAXEXTRUDERS; ++e, ++i)
	{
		motors[i] = &extruder[e].motor;
		temps[i] = &extruder[e].temp;
		objects[i] = &extruder[e];
	}
	for (uint8_t t = 0; t < MAXTEMPS; ++t, ++i)
	{
		motors[i] = NULL;
		temps[i] = &temp[t];
		objects[i] = &temp[t];
	}
	unsigned long time = micros ();
	for (uint8_t o = 0; o < MAXOBJECT; ++o)
	{
		if (motors[o]) {
			motors[o]->dist = NAN;
			motors[o]->next_dist = NAN;
			motors[o]->f = 0;
			motors[o]->continuous_steps_per_s = 0;
			motors[o]->audio_flags = 0;
			motors[o]->enable_pin.read (0x100);
			motors[o]->step_pin.read (0x100);
			motors[o]->dir_pin.read (0x100);
		}
		if (temps[o]) {
			temps[o]->last_time = time;
			temps[o]->is_on = false;
			temps[o]->min_alarm = NAN;
			temps[o]->max_alarm = NAN;
			temps[o]->target = NAN;
			temps[o]->power_pin.read (0x100);
			temps[o]->thermistor_pin.read (0x100);
		}
	}
	int16_t address = 0;
	objects[F0]->address = address;	// Not used, but initialized anyway.
	for (uint8_t o = 1; o < MAXOBJECT; ++o)
	{
		objects[o]->address = address;
		objects[o]->load (address, true);
	}
	if (address - 1 > E2END)
		debug ("Warning: data doesn't fit in EEPROM; decrease MAXAXES, MAXEXTRUDERS, or MAXTEMPS and reflash the firmware!");
	Serial.write (CMD_INIT);
	debug ("Eeprom used: %d, available: %d", address, E2END);
}
