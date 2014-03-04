// vim: set foldmethod=marker :

// {{{ Global variables.
var global;
var active_printer;
var rpc;
var update_handle;
var updater;
var printer;
// }}}

// {{{ Events from server.
function setup_updater () {
	updater = new Object ();
	updater.autodetect = global.autodetect.update;
	updater.blacklist = global.blacklist.update;
	updater.message = null;
	function show_message (m) {
		m = [m];
		if (updater.message == null) {
			updater.message = [];
			while (m.length != 0) {
				var msg = m.join ('; ');
				alert (msg);
				m = updater.message;
				updater.message = [];
			}
			updater.message = null;

		}
		else {
			updater.message.push (m);
		}
	}
	updater.reset = function (port) {
		show_message ('Printer ' + global.ports_list[port][1].name.entry.value + '(' + port + ') has reset unexpectedly.');
	}
	updater.stall = function (port) {
		show_message ('Printer ' + global.ports_list[port][1].name.entry.value + '(' + port + ') stalled on our command.');
	}
	updater.new_audio = function (list) {
		global.audio.ClearAll ();
		for (var i = 0; i < list.length; ++i) {
			for (var p in global.port_list) {
				if (global.ports_list[p][1] == null)
					continue
				global.ports_list[p][1].audio.AddElement ('option').AddText (list[i]);
			}
		}
	};
	updater.new_port = function (port) {
		var span = global.ports.AddElement ('span', 'portaction box2');
		span.radio = span.AddElement ('input');
		span.radio.type = 'radio';
		span.radio.name = 'port';
		span.radio.printername = span.AddElement ('span');
		span.AddElement ('span', 'portaction').AddText ('(' + port + ')');
		span.radio.onclick = function () {
			if (global.selected && global.ports_list[global.selected][1])
				global.ports_list[global.selected][1].AddClass ('hidden');
			global.selected = port;
			if (!global.ports_list[port][1]) {
				global.noprinter.RemoveClass ('hidden');
				global.disablebutton.AddClass ('hidden');
				global.detectbutton.RemoveClass ('hidden');
			}
			else {
				printer = global.ports_list[port][1];
				global.noprinter.AddClass ('hidden');
				global.disablebutton.RemoveClass ('hidden');
				global.detectbutton.AddClass ('hidden');
				global.ports_list[port][1].RemoveClass ('hidden');
				update_temps ();
			}
		};
		global.ports_list[port] = [span, null];
		if (global.selected == null)
			span.radio.click ();
	};
	updater.del_port = function (port) {
		if (port == global.selected) {
			global.noprinter.RemoveClass ('hidden');
			global.selected = null;
			printer = null;
		}
		global.ports.removeChild (global.ports_list[port][0]);
		delete global.ports_list[port];
	};
	updater.new_printer = function (port, constants) {
		global.ports_list[port][1] = global.printers.Add (Printer (port, constants));
		global.ports_list[port][0].RemoveClass ('portaction');
		if (port == global.selected)
			global.ports_list[port][0].radio.onclick ();
	};
	updater.del_printer = function (port) {
		global.ports_list[port][0].AddClass ('portaction');
		global.printers.removeChild (global.ports_list[port][1]);
		global.ports_list[port][1] = null;
		if (port == global.selected) {
			global.noprinter.RemoveClass ('hidden');
			global.selected = null;
			printer = null;
		}
	};
	updater.variables_update = function (port, values) {
		global.ports_list[port][1].update (values);
		global.ports_list[port][0].radio.printername.ClearAll ().AddText (global.ports_list[port][1].name.entry.value);
	};
	updater.axis_update = function (port, index, values) {
		global.ports_list[port][1].axes[index].update (values);
	};
	updater.extruder_update = function (port, index, values) {
		global.ports_list[port][1].extruders[index].update (values);
	};
	updater.temp_update = function (port, index, values) {
		global.ports_list[port][1].temps[index].update (values);
	};
	updater.gpio_update = function (port, index, values) {
		global.ports_list[port][1].gpios[index].update (values);
	};
	updater.printing = function (port, state) {
		var printer = global.ports_list[port][1];
		if (state)
			printer.AddClass ('printing');
		else
			printer.RemoveClass ('printing');
	};
	updater.scripts = new Object;
	updater.new_script = function (name, code, data) {
		updater.scripts[name] = global.custom.AddElement ('div');
		function update_data (new_data) {
			rpc.call ('set_data', [name, _rpc_tojson (new_data)], {}, null);
		}
		var this_script = updater.scripts[name];
		try {
			eval ('(' + code + ')') (name, updater.scripts[name], eval ('(' + data + ')'));
			var button = updater.scripts[name].AddElement ('button', 'portaction');
			button.type = 'button';
			button.AddText ('Remove');
			button.onclick = function () {
				rpc.call ('del_script', [name], {}, null);
			};
		}
		catch (e) {
			updater.del_script (name);
		}
	};
	updater.del_script = function (name) {
		global.custom.removeChild (updater.scripts[name]);
		delete updater.scripts[name];
	};
	updater.new_data = function (name, data) {
		updater.scripts[name].new_data (eval ('(' + data + ')'));
	};
	updater['confirm'] = function (message) {
		if (!confirm (message ? message : "Please confirm to continue."))
			rpc.multicall ([['pause', [true], {}], ['confirm', [], {}]], null);
		else
			rpc.call ('confirm', [], {}, null);
	};
}
// }}}

// {{{ Initialization.
function reconnect () {
	global.RemoveClass ('connected');
	rpc = null;
	for (var p in global.ports_list) {
		if (typeof global.ports_list[p] == 'object') {
			if (global.ports_list[p][1] != null)
				updater.del_printer (p);
			updater.del_port (p);
		}
	}
	for (var s in updater.scripts) {
		if (typeof updater.scripts[s] == 'object')
			updater.del_script (s);
	}
	rpc = Rpc (updater, setup, reconnect);
}

function init () {
	var proto = Object.prototype;
	proto.Add = function (object, className) { this.appendChild (object); if (className) object.className = className; return object; }
	proto.AddElement = function (name, className) { var element = document.createElement (name); return this.Add (element, className); }
	proto.AddText = function (text) { var t = document.createTextNode (text); return this.Add (t); }
	proto.ClearAll = function () { while (this.firstChild) this.removeChild (this.firstChild); return this; }
	proto.AddClass = function (className) {
		var classes = this.className.split (' ');
		if (classes.indexOf (className) >= 0)
			return;
		classes.push (className);
		this.className = classes.join (' ');
	}
	proto.RemoveClass = function (className) {
		var classes = this.className.split (' ');
		var pos = classes.indexOf (className);
		if (pos < 0)
			return;
		classes.splice (pos, 1);
		this.className = classes.join (' ');
	}
	Global ();
	document.getElementById ('container').Add (global);
	setup_updater ();
	rpc = Rpc (updater, setup, reconnect);
}

function setup () {
	global.AddClass ('connected');
	rpc.call ('set_monitor', [true], {}, null);
}
// }}}

// {{{ Temperature updates.
function do_update_temps (queue, pos) {
	if (!rpc)
		return;
	if (!pos)
		pos = 0;
	while (pos < queue.length && !queue[pos][0] ())
		++pos;
	if (pos >= queue.length) {
		if (update_handle != null)
			clearTimeout (update_handle);
		update_handle = setTimeout (update_temps, 5000);
	}
	else
		rpc.call (queue[pos][1], queue[pos][2], queue[pos][3], function (t) { queue[pos][4] (t); do_update_temps (queue, pos + 1); });
}

function update_temps () {
	update_handle = null;
	if (!rpc)
		return;
	var p = global.ports_list[global.selected];
	if (p && p[1]) {
		if (active_printer != p[1])
			rpc.call ('set_printer', [null, global.selected], {}, function () { active_printer = p[1]; do_update_temps (p[1].monitor_queue); });
		else
			do_update_temps (p[1].monitor_queue);
	}
}
// }}}

// {{{ Builders.
function Constant (printer, key, name, value) { // {{{
	var constant = document.createElement ('tr');
	printer.constants[key] = value;
	constant.AddElement ('td').AddText (name);
	constant.AddElement ('td').AddText (value);
	return constant;
} // }}}
function NumFunction (printer, name, object, part, index, negative) { // {{{
	var func = document.createElement ('tr');
	func.AddElement ('td').AddText (name);
	var td = func.AddElement ('td');
	var checkbox = td.AddElement ('input');
	checkbox.type = 'checkbox';
	if (negative) {
		td.AddText ('-');
		var checkbox2 = td.AddElement ('input');
		checkbox2.type = 'checkbox';
		td.AddText ('+');
		checkbox.onclick = function () {
			var value = Number (checkbox.checked ? -func.entry.value : Number.NaN);
			printer.call (object ? part + '_' + object : part, object ? [index, value] : [value], {}, null);
		};
		checkbox2.onclick = function () {
			var value = Number (checkbox2.checked ? func.entry.value : Number.NaN);
			printer.call (object ? part + '_' + object : part, object ? [index, value] : [value], {}, null);
		};
	}
	else {
		checkbox.onclick = function () {
			var value = Number (checkbox.checked ? func.entry.value : Number.NaN);
			printer.call (object ? part + '_' + object : part, object ? [index, value] : [value], {}, null);
		};
	}
	func.entry = func.AddElement ('input');
	func.entry.value = 'Infinity';
	func.entry.type = 'text';
	func.update = function (value) {
		if (negative) {
			checkbox.checked = value < 0;
			checkbox2.checked = value > 0;
			if (!isNaN (value) && value != 0)
				func.entry.value = Math.abs (value).toFixed (1);
		}
		else {
			checkbox.checked = !isNaN (value);
			if (!isNaN (value))
				func.entry.value = value.toFixed (1);
		}
	};
	return func;
} // }}}
function FileFunction (printer, name, object, part, index, send_name) { // {{{
	var func = document.createElement ('tr');
	func.AddElement ('td').AddText (name);
	var td = func.AddElement ('td');
	if (send_name) {
		func.entry = td.AddElement ('input');
		func.entry.type = 'text';
	}
	func.fileselect = td.AddElement ('input');
	func.fileselect.type = 'file';
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Send');
	button.onclick = function () {
		if (send_name && !func.entry.value) {
			alert ('Please select a name');
			return;
		}
		if (func.fileselect.files.length < 1) {
			alert ('Please select a file');
			return;
		}
		var reader = new FileReader ();
		reader.onload = function (e) {
			function errors (err) {
				if (err.length == 0)
					return;
				alert ('Errors in lines: ' + err.join (', '));
			}
			if (e.target.readyState == FileReader.DONE) {
				if (send_name)
					printer.call (object ? part + '_' + object : part, object ? [index, func.entry.value, e.target.result] : [func.entry.value, e.target.result], {}, errors);
				else
					printer.call (object ? part + '_' + object : part, object ? [index, e.target.result] : [e.target.result], {}, errors);
			}
		}
		reader.readAsBinaryString (func.fileselect.files[0]);
	};
	return func;
} // }}}
function Button (printer, name, object, part, index) { // {{{
	var tr = document.createElement ('tr');
	var td = tr.AddElement ('td');
	td.colSpan = 2;
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText (name);
	button.onclick = function () {
		printer.call (object ? part + '_' + object : part, object ? [index] : [], {}, null);
	};
	return tr;
} // }}}
function Checkbox (printer, name, object, part, index, action) { // {{{
	var tr = document.createElement ('tr');
	tr.AddElement ('td').AddText (name);
	var checkbox = tr.AddElement ('td').AddElement ('input');
	checkbox.type = 'checkbox';
	checkbox.onclick = function () {
		printer.call (object ? part + (action ? '_' : '_set_') + object : (action ? '' : 'set_') + part, object ? [index, this.checked] : [this.checked], {}, null);
	};
	tr.update = function (value) { checkbox.checked = value; }
	return tr;
} // }}}
function Text (printer, name, object, part, index) { // {{{
	var text = document.createElement ('tr');
	text.AddElement ('td').AddText (name);
	text.entry = text.AddElement ('td').AddElement ('input');
	text.entry.type = 'text';
	var button = text.AddElement ('button');
	button.type = 'button';
	button.AddText ('Set');
	text.update = function (value) {
		text.entry.value = String (value);
	};
	button.onclick = function () {
		printer.set (object, part, index, text.entry.value);
	};
	return text;
} // }}}
function Range (printer, name, object, part, index, max, gpio) { // {{{
	var range = document.createElement ('tr');
	range.AddElement ('td').AddText (name);
	var td = range.AddElement ('td');
	range.select = td.AddElement ('select');
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Set');
	button.onclick = function () {
		printer.set (object, part, index, Number (range.select.options[range.select.selectedIndex].value));
	};
	range.update = function (value) {
		range.select.ClearAll ();
		if (gpio) {
			var option = range.select.AddElement ('option');
			option.value = 0;
			option.AddText ('None');
			if (value == null)
				option.selected = true;
			for (var o = 0; o <= printer.constants.maxextruders + printer.constants.maxtemps; ++o) {
				var option = range.select.AddElement ('option');
				option.value = 2 + printer.constants.maxaxes + o;
				if (o < printer.constants.maxextruders)
					option.AddText ('Extruder ' + String (o));
				else
					option.AddText ('Temp ' + String (o - printer.constants.maxextruders));
				if (value == option.value)
					option.selected = true;
			}
		}
		else {
			for (var o = 0; o <= max; ++o) {
				var option = range.select.AddElement ('option');
				option.value = o;
				option.AddText (String (o));
				if (value == o)
					option.selected = true;
			}
		}
	};
	return range;
} // }}}
function Choice (printer, name, object, part, index, list, radio) { // {{{
	var choice = document.createElement ('tr');
	choice.AddElement ('td').AddText (name);
	choice.radios = [];
	if (radio) {
		var table = choice.AddElement ('table');
		for (var o = 0; o < list.length; ++o) {
			var td = table.AddElement ('tr').AddElement ('td');
			choice.radios[o] = td.AddElement ('input');
			choice.radios[o].type = 'radio';
			choice.radios[o].name = 'choice' + part + String (name);
			choice.radios[o].value = String (o);
			choice.radios[o].onclick = function () {
				printer.set (object, part, index, Number (this.value));
			};
			td.AddText (list[o]);
		}
	}
	else {
		var td = choice.AddElement ('td');
		choice.select = td.AddElement ('select');
		for (var o = 0; o < list.length; ++o) {
			var option = choice.select.AddElement ('option');
			option.value = o;
			option.AddText (list[o]);
		}
		var button = td.AddElement ('button');
		button.type = 'button';
		button.AddText ('Set');
		button.onclick = function () { printer.set (object, part, index, choice.select.selectedIndex); };
	}
	choice.update = function (value) {
		if (radio) {
			if (value in choice.radios)
				choice.radios[value].selected = true;
		}
		else
			choice.select.selectedIndex = value;
	};
	return choice;
} // }}}
function Float (printer, name, object, part, index, factor) { // {{{
	var the_float = document.createElement ('tr');
	the_float.AddElement ('td').AddText (name);
	var td = the_float.AddElement ('td');
	the_float.entry = td.AddElement ('input');
	the_float.entry.type = 'text';
	the_float.factor = factor ? factor : 1;
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Set');
	button.onclick = function () { printer.set (object, part, index, Number (the_float.entry.value) * the_float.factor); };
	the_float.update = function (value) { the_float.entry.value = (Number (value) / the_float.factor).toFixed (1); };
	return the_float;
} // }}}
function Pin (printer, name, object, part, index, analog) { // {{{
	var pin = document.createElement ('tr');
	pin.AddElement ('td').AddText (name);
	var td = pin.AddElement ('td');
	pin.select = td.AddElement ('select');
	for (var o = 0; o < (analog ? printer.constants.num_pins - printer.constants.num_digital_pins : printer.constants.num_pins); ++o) {
		var option = pin.select.AddElement ('option');
		option.value = o;
		if (analog) {
			option.AddText ('A' + String (o));
		}
		else {
			if (o < printer.constants.num_digital_pins)
				option.AddText ('D' + String (o));
			else
				option.AddText ('A' + String (o - printer.constants.num_digital_pins));
		}
	}
	pin.invalid = td.AddElement ('input');
	pin.invalid.type = 'checkbox';
	td.AddText ('Invalid');
	if (!analog) {
		var invertbox = td.AddElement ('span');
		pin.inverted = invertbox.AddElement ('input');
		pin.inverted.type = 'checkbox';
		invertbox.AddText ('Inverted');
	}
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Set');
	button.onclick = function () {
		printer.set (object, part, index, Number (pin.select.value) + (pin.invalid.checked ? 0x100 : 0) + (!analog && pin.inverted.checked ? 0x200 : 0));
	};
	pin.update = function (value) {
		pin.select.selectedIndex = Number (value) & 0xff;
		var is_invalid = Boolean (Number (value) & 0x100);
		var is_inverted = Boolean (Number (value) & 0x200);
		pin.invalid.checked = is_invalid;
		if (!analog)
			pin.inverted.checked = is_inverted;
	};
	return pin;
} // }}}
function Motor (printer, object, index, is_extruder) { // {{{
	var motor = document.createElement ('tr');
	motor.className = 'motor';
	var box = motor.AddElement ('td');
	box.colSpan = 2;
	var table = box.AddElement ('table');
	motor.step_pin = table.Add (Pin (printer, 'Step pin', object + '_motor', 'step_pin', index), 'pin');
	motor.dir_pin = table.Add (Pin (printer, 'Direction pin', object + '_motor', 'dir_pin', index), 'pin');
	motor.enable_pin = table.Add (Pin (printer, 'Enable pin', object + '_motor', 'enable_pin', index), 'pin');
	motor.steps_per_mm = table.Add (Float (printer, 'Steps per mm', object + '_motor', 'steps_per_mm', index), is_extruder ? 'useful' : 'setting');
	motor.max_v_neg = table.Add (Float (printer, 'Max speed (-) [mm/s]', object + '_motor', 'max_v_neg', index), 'setting');
	motor.max_v_pos = table.Add (Float (printer, 'Max speed (+) [mm/s]', object + '_motor', 'max_v_pos', index), 'setting');
	motor.max_a = table.Add (Float (printer, 'Max acceleration [mm/s²]', object + '_motor', 'max_a', index), 'setting');
	var buttonbox = table.AddElement ('tr', 'setting').AddElement ('td');
	buttonbox.colSpan = 2;
	var button = buttonbox.AddElement ('button');
	button.type = 'button';
	button.AddText ('Setup Motor');
	button.onclick = function () {
		this.step_pin.set ();
		this.dir_pin.set ();
		this.enable_pin.set ();
		this.steps_per_mm.set ();
		this.max_v_pos.set ();
		this.max_v_neg.set ();
		this.max_a.set ();
	};
	var run = table.Add (NumFunction (printer, 'Run', object, 'run', index, true), 'action');
	var sleep = table.Add (Checkbox (printer, 'Sleep', object, 'sleep', index, true), 'action');
	motor.update = function (values) {
		this.step_pin.update (values[0]);
		this.dir_pin.update (values[1]);
		this.enable_pin.update (values[2]);
		this.steps_per_mm.update (values[3]);
		this.max_v_pos.update (values[4]);
		this.max_v_neg.update (values[5]);
		this.max_a.update (values[6]);
		run.update (values[7]);
		sleep.update (values[8]);
	};
	return motor;
} // }}}
function Temp (printer, name, object, index) { // {{{
	var temp, table;
	if (name != null) {
		temp = document.createElement ('td', 'temp box inactive');
		table = temp.AddElement ('table');
		var th = table.AddElement ('tr').AddElement ('th');
		th.colSpan = 2;
		th.AddText ('Temp ' + String (name));
	}
	else {
		temp = document.createElement ('tr');
		temp.className = 'temp';
		var td = temp.AddElement ('td');
		td.colSpan = 2;
		table = td.AddElement ('table');
	}
	var settempname;
	if (object) {
		settempname = object;
		object += '_temp';
	}
	else {
		object = 'temp';
		settempname = object;
	}
	temp.power_pin = table.Add (Pin (printer, 'Power pin', object, 'power_pin', index), 'pin');
	temp.thermistor_pin = table.Add (Pin (printer, 'Thermistor pin', object, 'thermistor_pin', index, true), 'pin');
	temp.R0 = table.Add (Float (printer, 'R0 [kΩ]', object, 'R0', index, 1000), 'setting');
	temp.R1 = table.Add (Float (printer, 'R1 [kΩ]', object, 'R1', index, 1000), 'setting');
	temp.Rc = table.Add (Float (printer, 'Rc [kΩ]', object, 'Rc', index, 1000), 'setting');
	temp.Tc = table.Add (Float (printer, 'Tc [°C]', object, 'Tc', index), 'setting');
	temp.beta = table.Add (Float (printer, 'β [K]', object, 'beta', index), 'setting');
	temp.core_C = table.Add (Float (printer, 'Core C [J/K]', object, 'core_C', index), 'future');
	temp.shell_C = table.Add (Float (printer, 'Shell C [J/K]', object, 'shell_C', index), 'future');
	temp.transfer = table.Add (Float (printer, 'Transfer [W/K]', object, 'transfer', index), 'future');
	temp.radiation = table.Add (Float (printer, 'Radiation [W/K⁴]', object, 'radiation', index), 'future');
	temp.power = table.Add (Float (printer, 'Power [W]', object, 'power', index), 'future');
	var td = table.AddElement ('tr', 'setting').AddElement ('td');
	td.colSpan = 2;
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Setup temp');
	button.onclick = function () {
		temp.power_pin.set ();
		temp.thermistor_pin.set ();
		temp.R0.set ();
		temp.R1.set ();
		temp.Rc.set ();
		temp.Tc.set ();
		temp.beta.set ();
		temp.core_C.set ();
		temp.shell_C.set ();
		temp.transfer.set ();
		temp.radiation.set ();
		temp.power.set ();
	};
	var value = table.Add (NumFunction (printer, 'Enable', settempname, 'settemp', index), 'action');
	value.entry.AddClass ('hidden');
	var tr = table.AddElement ('tr', 'hidden');
	tr.AddElement ('td').AddText ('Temperature');
	td = tr.AddElement ('td');
	temp.current = td.AddElement ('span');
	td.AddText ('°C');
	printer.monitor_queue.push ([function () { return !temp.thermistor_pin.invalid.checked; }, 'readtemp_' + settempname, [index], {}, function (t) { temp.current.ClearAll ().AddText (t.toFixed (1)); }]);
	temp.update = function (values) {
		this.power_pin.update (values[0]);
		this.thermistor_pin.update (values[1]);
		if (this.thermistor_pin.invalid.checked) {
			value.entry.value = 'Infinity';
			value.entry.AddClass ('hidden');
			tr.AddClass ('hidden');
		}
		else {
			value.entry.RemoveClass ('hidden');
			tr.RemoveClass ('hidden');
		}
		this.R0.update (values[2]);
		this.R1.update (values[3]);
		this.Rc.update (values[4]);
		this.Tc.update (values[5]);
		this.beta.update (values[6]);
		this.core_C.update (values[7]);
		this.shell_C.update (values[8]);
		this.transfer.update (values[9]);
		this.radiation.update (values[10]);
		this.power.update (values[11]);
		value.update (values[12]);
	};
	return temp;
} // }}}
function Gpio (printer, name, index) { // {{{
	var gpio, table;
	gpio = document.createElement ('td', 'gpio box inactive');
	table = gpio.AddElement ('table');
	var th = table.AddElement ('tr').AddElement ('th');
	th.colSpan = 2;
	th.AddText ('GPIO ' + String (name));
	gpio.pin = table.Add (Pin (printer, 'Pin', 'gpio', 'pin', index), 'pin');
	gpio.state = table.Add (Choice (printer, 'State', 'gpio', 'state', index, ['Disconnected', 'Input', 'Low', 'High'], true), 'useful');
	gpio.master = table.Add (Range (printer, 'Master temp', 'gpio', 'master', index, null, true), 'setting');
	gpio.value = table.Add (Float (printer, 'Trigger', 'gpio', 'value', index, 1), 'setting');
	gpio.update = function (values) {
		this.pin.update (values[0]);
		this.state.update (values[1]);
		this.master.update (values[2]);
		this.value.update (values[3]);
	};
	return gpio;
} // }}}
function Axis (printer, name, index) { // {{{
	var axis = document.createElement ('td');
	axis.className = 'axis box inactive';
	var table = axis.AddElement ('table');
	var th = table.AddElement ('tr').AddElement ('th');
	th.colSpan = 2;
	th.AddText (name < 3 ? 'Axis ' + String (name) + ': ' + String.fromCharCode ('X'.charCodeAt (0) + name) : 'Axis ' + String (name));
	axis.motor = table.Add (Motor (printer, 'axis', index));
	axis.limit_min_pin = table.Add (Pin (printer, 'Min limit pin', 'axis', 'limit_min_pin', index), 'pin');
	axis.limit_max_pin = table.Add (Pin (printer, 'Max limit pin', 'axis', 'limit_max_pin', index), 'pin');
	axis.sense_pin = table.Add (Pin (printer, 'Sense pin', 'axis', 'sense_pin', index), 'pin');
	axis.limit_min_pos = table.Add (Float (printer, 'Min limit position', 'axis', 'limit_min_pos', index), 'setting');
	axis.limit_max_pos = table.Add (Float (printer, 'Max limit position', 'axis', 'limit_max_pos', index), 'setting');
	axis.delta_length = table.Add (Float (printer, 'Delta rod length', 'axis', 'delta_length', index), 'setting');
	axis.delta_radius= table.Add (Float (printer, 'Delta radius', 'axis', 'delta_radius', index), 'setting');
	axis.offset = table.Add (Float (printer, 'Offset', 'axis', 'offset', index), 'useful');
	// Goto.
	var tr = table.AddElement ('tr', 'action')
	tr.AddElement ('td').AddText ('Goto');
	axis.dist = tr.AddElement ('td').AddElement ('input');
	axis.dist.type = 'text';
	axis.dist.value = '0';
	var td = tr.AddElement ('td');
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Go');
	button.onclick = function () {
		var arg = new Object ()
		arg[name] = Number (axis.dist.value);
		printer.call ('goto', [arg], {}, null);
	};
	// Current pos.
	tr = table.AddElement ('tr', 'action')
	tr.AddElement ('td').AddText ('Position');
	td = tr.AddElement ('td');
	axis.pos = td.AddElement ('input');
	axis.pos.type = 'text';
	axis.pos.value = '';
	button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Get');
	button.onclick = function () {
		printer.call ('axis_get_current_pos', [name], {}, function (pos) {
			axis.pos.value = pos[1].toFixed (1);
		});
	};
	td = table.AddElement ('tr', 'setting').AddElement ('td');
	td.colSpan = 2;
	button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Setup Axis');
	button.onclick = function () {
		this.motor.set ();
		this.limit_min_pin.set ();
		this.limit_max_pin.set ();
		this.sense_pin.set ();
		this.limit_min_pos.set ();
		this.limit_max_pos.set ();
		this.delta_length.set ();
		this.delta_radius.set ();
		this.offset.set ();
	};
	axis.update = function (values) {
		this.motor.update (values[0]);
		this.limit_min_pin.update (values[1]);
		this.limit_max_pin.update (values[2]);
		this.sense_pin.update (values[3]);
		this.limit_min_pos.update (values[4]);
		this.limit_max_pos.update (values[5]);
		this.delta_length.update (values[6]);
		this.delta_radius.update (values[7]);
		this.offset.update (values[8]);
	};
	return axis;
} // }}}
function Extruder (printer, name, index) { // {{{
	var extruder = document.createElement ('td');
	extruder.className = 'extruder box inactive';
	var table = extruder.AddElement ('table');
	var th = table.AddElement ('tr').AddElement ('th');
	th.colSpan = 2;
	th.AddText ('Extruder ' + String (name));
	extruder.motor = table.Add (Motor (printer, 'extruder', index, true));
	extruder.temp = table.Add (Temp (printer, null, 'extruder', index));
	extruder.filament_heat = table.Add (Float (printer, 'Filament heat [J/mm]', 'extruder', 'filament_heat', index), 'future');
	extruder.nozzle_size = table.Add (Float (printer, 'Nozzle diameter [mm]', 'extruder', 'nozzle_size', index), 'future');
	extruder.filament_size = table.Add (Float (printer, 'Filament diameter [mm]', 'extruder', 'filament_size', index), 'future');
	var td = table.AddElement ('tr', 'setting').AddElement ('td');
	td.colSpan = 2;
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('Setup Extruder');
	button.onclick = function () {
		this.motor.set ();
		this.temp.set ();
		this.filament_heat.set ();
		this.nozzle_size.set ();
		this.filament_size.set ();
	};
	// Move.
	var tr = table.AddElement ('tr', 'action')
	tr.AddElement ('td').AddText ('Move');
	var td = tr.AddElement ('td');
	var button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('-');
	button.onclick = function () {
		printer.call ('goto', [], {'e': Number (-extruder.dist.value)}, null);
	};
	button = td.AddElement ('button');
	button.type = 'button';
	button.AddText ('+');
	button.onclick = function () {
		printer.call ('goto', [], {'e': Number (extruder.dist.value)}, null);
	};
	extruder.dist = td.AddElement ('input');
	extruder.dist.type = 'text';
	extruder.dist.value = '10';
	extruder.update = function (values) {
		this.motor.update (values[0]);
		this.temp.update (values[1]);
		this.filament_heat.update (values[2]);
		this.nozzle_size.update (values[3]);
		this.filament_size.update (values[4]);
	};
	return extruder;
} // }}}
function Printer (port, constants) { // {{{
	var printer = document.createElement ('table');
	printer.monitor_queue = [];
	printer.className = 'printer hidden';
	printer.call = function (name, a, ka, cb) {
		if (active_printer != printer)
			rpc.call ('set_printer', [null, port], {}, function () { active_printer = printer; rpc.call (name, a, ka, cb); });
		else
			rpc.call (name, a, ka, cb);
	};
	printer.get = global.get;
	printer.set = global.set;
	printer.constants = {};
	printer.namelen = printer.Add (Constant (printer, 'namelen', 'Name length [B]', constants[0]), 'constants');
	printer.maxaxes = printer.Add (Constant (printer, 'maxaxes', 'Maximum number of axes', constants[1]), 'constants');
	printer.maxextruders = printer.Add (Constant (printer, 'maxextruders', 'Maximum number of extruders', constants[2]), 'constants');
	printer.maxtemps = printer.Add (Constant (printer, 'maxtemps', 'Maximum number of temps', constants[3]), 'constants');
	printer.maxgpios = printer.Add (Constant (printer, 'maxgpios', 'Maximum number of gpios', constants[4]), 'constants');
	printer.audio_fragments = printer.Add (Constant (printer, 'audio_fragments', 'Number of audio fragments', constants[5]), 'constants audio');
	printer.audio_fragment_size = printer.Add (Constant (printer, 'audio_fragment_size', 'Audio fragment size [B]', constants[6]), 'constants audio');
	printer.num_digital_pins = printer.Add (Constant (printer, 'num_digital_pins', 'Number of digital pins', constants[7]), 'constants');
	printer.num_pins = printer.Add (Constant (printer, 'num_pins', 'Total number of pins', constants[8]), 'constants');
	printer.axes = [];
	printer.extruders = [];
	printer.temps = [];
	printer.gpios = [];
	printer.name = printer.Add (Text (printer, 'Name', null, 'name', null), 'setting');
	printer.num_axes = printer.Add (Range (printer, 'Number of axes', null, 'num_axes', null, printer.constants.maxaxes), 'setting');
	printer.num_extruders = printer.Add (Range (printer, 'Number of extruders', null, 'num_extruders', null, printer.constants.maxextruders), 'setting');
	printer.num_temps = printer.Add (Range (printer, 'Number of temps', null, 'num_temps', null, printer.constants.maxtemps), 'setting');
	printer.num_gpios = printer.Add (Range (printer, 'Number of gpios', null, 'num_gpios', null, printer.constants.maxgpios), 'setting');
	printer.type = printer.Add (Choice (printer, 'Printer type', null, 'printer_type', null, ['Cartesian', 'Delta']), 'setting');
	printer.led_pin = printer.Add (Pin (printer, 'Led pin', null, 'led_pin', null), 'pin');
	printer.room_T = printer.Add (Float (printer, 'Room temperature [°C]', null, 'room_T', null), 'future');
	printer.motor_limit = printer.Add (Float (printer, 'Maximum idle time for motors [s]', null, 'motor_limit', null, 1000), 'setting');
	printer.temp_limit = printer.Add (Float (printer, 'Maximum idle time for temps [s]', null, 'temp_limit', null, 1000), 'setting');
	printer.feedrate = printer.Add (Float (printer, 'Command feed factor', null, 'feedrate', null), 'useful');

	printer.Add (Button (printer, 'Load all', null, 'load_all', null), 'setting');
	printer.Add (Button (printer, 'Save all', null, 'save_all', null), 'setting');
	printer.link = printer.AddElement ('tr', 'setting').AddElement ('td').AddElement ('a');
	printer.link.AddText ('Export settings');
	printer.Add (FileFunction (printer, 'Import settings', null, 'import_settings', null, false), 'setting');
	printer.pause = printer.Add (Checkbox (printer, 'Pause', null, 'pause', null, true), 'action');
	// TODO: audio play	choice and go
	printer.Add (FileFunction (printer, 'Print G-Code', null, 'gcode', null, false), 'action');
	printer.Add (Button (printer, 'Home all', null, 'home_all', null), 'action');
	printer.Add (Button (printer, 'Sleep all', null, 'sleep_all', null), 'action');

	var td = printer.AddElement ('tr').AddElement ('td');
	td.colSpan = 2;
	var table = td.AddElement ('table');
	var tr = table.AddElement ('tr', 'action');
	tr.AddElement ('th').AddText ('Move');
	for (var m = 0; m < 3; ++m) {
		var input = tr.AddElement ('td').AddElement ('input');
		input.type = 'text';
		input.value = ['1', '10', '100'][m];
		input.onkeydown = function (e) {
			var me = this;
			var code = e.which || e.keyCode;
			switch (code) {
				case 33: // Page up
					printer.call ('axis_get_current_pos', [2], {}, function (pos) {
						printer.call ('goto', [{2: pos[1] + Number (me.value)}], {}, null);
					});
					break;
				case 34: // Page down
					printer.call ('axis_get_current_pos', [2], {}, function (pos) {
						printer.call ('goto', [{2: pos[1] - Number (me.value)}], {}, null);
					});
					break;
				case 37: // Left
					printer.call ('axis_get_current_pos', [0], {}, function (pos) {
						printer.call ('goto', [{0: pos[1] - Number (me.value)}], {}, null);
					});
					break;
				case 38: // Up
					printer.call ('axis_get_current_pos', [1], {}, function (pos) {
						printer.call ('goto', [{1: pos[1] + Number (me.value)}], {}, null);
					});
					break;
				case 39: // Right
					printer.call ('axis_get_current_pos', [0], {}, function (pos) {
						printer.call ('goto', [{0: pos[1] + Number (me.value)}], {}, null);
					});
					break;
				case 40: // Down
					printer.call ('axis_get_current_pos', [1], {}, function (pos) {
						printer.call ('goto', [{1: pos[1] - Number (me.value)}], {}, null);
					});
					break;
			}
		};
	}
	tr = table.AddElement ('tr');
	for (var a = 0; a < printer.constants.maxaxes; ++a)
		printer.axes[a] = tr.Add (Axis (printer, a, a), 'inactive');
	tr = table.AddElement ('tr');
	for (var e = 0; e < printer.constants.maxextruders; ++e)
		printer.extruders[e] = tr.Add (Extruder (printer, e, e), 'inactive');
	tr = table.AddElement ('tr');
	for (var t = 0; t < printer.constants.maxtemps; ++t)
		printer.temps[t] = tr.Add (Temp (printer, t, null, t), 'inactive');
	tr = table.AddElement ('tr');
	for (var g = 0; g < printer.constants.maxgpios; ++g)
		printer.gpios[g] = tr.Add (Gpio (printer, g, g), 'inactive');
	printer.update = function (values) {
		this.name.update (values[0]);
		this.num_axes.update (values[1]);
		this.num_extruders.update (values[2]);
		this.num_temps.update (values[3]);
		this.num_gpios.update (values[4]);
		this.type.update (values[5]);
		this.led_pin.update (values[6]);
		this.room_T.update (values[7]);
		this.motor_limit.update (values[8]);
		this.temp_limit.update (values[9]);
		this.feedrate.update (values[10]);
		this.pause.update (values[11]);
		for (var a = 0; a < printer.constants.maxaxes; ++a) {
			if (a < printer.num_axes.select.selectedIndex)
				printer.axes[a].RemoveClass ('inactive');
			else
				printer.axes[a].AddClass ('inactive');
		}
		for (var e = 0; e < printer.constants.maxextruders; ++e) {
			if (e < printer.num_extruders.select.selectedIndex)
				printer.extruders[e].RemoveClass ('inactive');
			else
				printer.extruders[e].AddClass ('inactive');
		}
		for (var t = 0; t < printer.constants.maxtemps; ++t) {
			if (t < printer.num_temps.select.selectedIndex)
				printer.temps[t].RemoveClass ('inactive');
			else
				printer.temps[t].AddClass ('inactive');
		}
		for (var g = 0; g < printer.constants.maxgpios; ++g) {
			if (g < printer.num_gpios.select.selectedIndex)
				printer.gpios[g].RemoveClass ('inactive');
			else
				printer.gpios[g].AddClass ('inactive');
		}
		this.link.href = encodeURIComponent (this.name.entry.value) + '.ini?port=' + encodeURIComponent (port);
	};
	return printer;
} // }}}
function Global () { // {{{
	global = document.createElement ('div');
	global.className = 'connected global';
	global.call = function (name, a, ka, reply) {
		rpc.call (name, a, ka, reply);
	};
	global.get = function (object, part, index, cb) {
		if (object)
			return [object + '_get_' + part, [index], {}, cb];
		else
			return ['get_' + part, [], {}, cb];
	};
	global.set = function (object, part, index, value) {
		if (object)
			rpc.call (object + '_set_' + part, [index, value], {}, null);
		else
			rpc.call ('set_' + part, [value], {}, null);
	};
	global.ports_list = {}
	global.selected = null;
	printer = null;
	update_temps ();
	var table = global.AddElement ('div', 'views');
	var views = [['view', 'Show visibility', null], ['action', 'Actions', true], ['useful', 'Useful settings', true], ['setting', 'Other settings', false], ['pin', 'Pins', false], ['inactive', 'Disabled elements', false], ['future', 'Unused features', false], ['constants', 'Constants', false], ['portaction', 'Port administration', false], ['audio', 'Audio', false]];
	for (var which = 0; which < views.length; ++which) {
		var tr = table.AddElement ('tr', views[which][2] === null ? undefined : 'view');
		var td = tr.AddElement ('td');
		var checkbox = td.AddElement ('input');
		checkbox.which = which;
		checkbox.type = 'checkbox';
		td.AddText (views[which][1]);
		checkbox.onclick = function () {
			if (this.checked)
				global.RemoveClass ('no' + views[this.which][0]);
			else
				global.AddClass ('no' + views[this.which][0]);
		};
		if (views[which][2])
			checkbox.checked = true;
		checkbox.onclick ();
	}
	table = global.AddElement ('table');
	global.autodetect = table.Add (Checkbox (global, 'Autodetect', null, 'autodetect', null), 'portaction');
	// TODO: default printer
	global.blacklist = table.Add (Text (global, 'Blacklist', null, 'blacklist', null), 'portaction');
	table.Add (FileFunction (global, 'Upload audio', null, 'audio_load', null, true), 'audio');

	var buttonbox = table.AddElement ('tr').AddElement ('td');
	td.colSpan = 2;
	var button = buttonbox.AddElement ('button', 'portaction');
	button.AddText ('Upload new firmware');
	var board = buttonbox.AddElement ('select', 'portaction');
	var boards = [['Melzi', 'melzi'], ['Ramps', 'ramps']];
	for (var i = 0; i < boards.length; ++i)
		board.AddElement ('option').AddText (boards[i][0]);
	board.firstChild.selected = true;
	button.onclick = function () {
		rpc.call ('upload', [global.selected, boards[board.selectedIndex][1]], {}, null);
	}
	var span = global.AddElement ('span');
	span.AddText ('Printer:');
	global.ports = span.AddElement ('span');
	global.printers = global.AddElement ('div');
	var buttons = span.AddElement ('span', 'portaction');
	global.disablebutton = buttons.AddElement ('button');
	global.disablebutton.type = 'button';
	global.disablebutton.AddText ('Disable');
	global.disablebutton.onclick = function () {
		if (!global.ports_list[global.selected][1])
			return;
		rpc.call ('disable', [global.selected], {}, null);
	};
	global.detectbutton = buttons.AddElement ('button');
	global.detectbutton.type = 'button';
	global.detectbutton.AddText ('Detect');
	global.detectbutton.onclick = function () {
		if (global.ports_list[global.selected][1])
			return;
		rpc.call ('detect', [global.selected], {}, null);
	};
	global.noprinter = global.printers.AddElement ('div', 'hidden');
	global.noprinter.AddText ('No printer is selected');
	global.custom = global.AddElement ('div');
	global.custom.AddElement ('table', 'portaction').Add (FileFunction (global, 'Upload script', null, 'new_script', null));
} // }}}
// }}}
