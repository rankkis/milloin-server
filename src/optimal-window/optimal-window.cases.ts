import { WASH_ENERGY_KWH } from '../wash-laundry/wash-laundry.service';
import { OptimalWindowCaseDto } from './dto/optimal-window.dto';

/** Preset requests served at GET /optimal-window/cases/{case} */
export const OPTIMAL_WINDOW_CASES: OptimalWindowCaseDto[] = [
  {
    case: 'wash-laundry',
    description: 'A washing machine program',
    durationHours: 2,
    energyKwh: WASH_ENERGY_KWH,
  },
  {
    case: 'charge-ev',
    description: 'Charging an electric vehicle',
    durationHours: 4,
    energyKwh: 11,
  },
];
