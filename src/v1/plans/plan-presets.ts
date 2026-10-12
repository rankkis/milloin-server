import { PlanPresetDto } from './dto/plans.dto';

/** Ready-made loads at GET /v1/electricity/plans/presets/{name} */
export const PLAN_PRESETS: PlanPresetDto[] = [
  {
    name: 'laundry',
    description: 'A washing machine program: 2 hours, 1.5 kWh',
    pausable: false,
    durationHours: 2,
    energyKwh: 1.5,
  },
  {
    name: 'sauna',
    description:
      'Heating an electric sauna: about an hour to warm up and two hours of bathing, 8 kWh',
    pausable: false,
    durationHours: 3,
    energyKwh: 8,
  },
  {
    name: 'ev-charging',
    description:
      'Charging an electric vehicle: 44 kWh at 11 kW, pausing in between',
    pausable: true,
    energyKwh: 44,
    maxPowerKw: 11,
  },
];
