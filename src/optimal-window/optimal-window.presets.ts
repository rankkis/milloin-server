import { WASH_ENERGY_KWH } from '../wash-laundry/wash-laundry.service';
import { OptimalWindowPresetDto } from './dto/optimal-window.dto';

/** Preset requests served at GET /optimal-window/presets/{preset} */
export const OPTIMAL_WINDOW_PRESETS: OptimalWindowPresetDto[] = [
  {
    name: 'wash-laundry',
    description: 'A washing machine program',
    durationHours: 2,
    energyKwh: WASH_ENERGY_KWH,
  },
  {
    name: 'charge-ev',
    description: 'Charging an electric vehicle',
    durationHours: 4,
    energyKwh: 11,
  },
];
