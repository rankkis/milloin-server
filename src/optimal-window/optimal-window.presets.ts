import { WASH_ENERGY_KWH } from '../wash-laundry/wash-laundry.service';
import { OptimalWindowPresetDto } from './dto/optimal-window.dto';

/** Preset requests served at GET /optimal-window/presets/{preset} */
export const OPTIMAL_WINDOW_PRESETS: OptimalWindowPresetDto[] = [
  {
    name: 'wash-laundry',
    description: 'A washing machine program',
    durationHours: 2,
    energyKwh: WASH_ENERGY_KWH,
    // Start now or with a timer delay of 1 to 5 hours
    startOffsetsHours: [0, 1, 2, 3, 4, 5],
  },
  {
    name: 'charge-ev',
    description: 'Charging an electric vehicle',
    durationHours: 4,
    energyKwh: 11,
  },
];
