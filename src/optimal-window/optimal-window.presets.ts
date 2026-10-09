import { OptimalWindowPresetDto } from './dto/optimal-window.dto';

/** Preset requests served at GET /optimal-window/presets/{preset} */
export const OPTIMAL_WINDOW_PRESETS: OptimalWindowPresetDto[] = [
  {
    name: 'wash-laundry',
    description: 'A washing machine program',
    durationHours: 2,
    energyKwh: 1.5,
    // Start now or with a timer delay of 1 to 5 hours
    startOffsetsHours: [0, 1, 2, 3, 4, 5],
  },
  {
    name: 'charge-ev',
    description: 'Charging an electric vehicle',
    durationHours: 4,
    energyKwh: 11,
  },
  {
    name: 'sauna',
    description:
      'Heating an electric sauna: about an hour to warm up and two hours of bathing',
    durationHours: 3,
    energyKwh: 8,
    // Compare clock-time starts today and tomorrow
    startEveryFullHour: true,
  },
];
