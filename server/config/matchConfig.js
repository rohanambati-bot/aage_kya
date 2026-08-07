/**
 * Configuration constants for Part A: Local Match Engine
 */

export const MATCH_WEIGHTS = Object.freeze({
  academicFit: 0.35,
  streamFit: 0.20,
  locationFit: 0.20,
  budgetFit: 0.15,
  outcomeSignal: 0.10,
})

export const MATCH_TIER_HIGH = 75
export const MATCH_TIER_MODERATE = 50

export const SIZE_SMALL_MAX = 500
export const SIZE_MID_MAX = 2000

// Location distance constants (in kilometers)
export const LOCATION_FULL_SCORE_KM = 25    // ≤ 25km = 100 points
export const LOCATION_FLOOR_KM = 500        // ≥ 500km = 25 points floor
export const LOCATION_FLOOR_SCORE = 25

// Budget bands in INR per year
export const BUDGET_BANDS = Object.freeze({
  below_1L: 100000,
  '1L-3L': 300000,
  '3L-6L': 600000,
  above_6L: Infinity,
})

// Fallback state adjacency map (used when lat/long coordinates are unavailable)
export const NEIGHBOURING_STATES = Object.freeze({
  'Andhra Pradesh': ['Telangana', 'Tamil Nadu', 'Karnataka', 'Odisha', 'Puducherry'],
  'Arunachal Pradesh': ['Assam', 'Nagaland'],
  'Assam': ['Arunachal Pradesh', 'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 'Meghalaya', 'West Bengal'],
  'Bihar': ['Uttar Pradesh', 'Jharkhand', 'West Bengal'],
  'Chhattisgarh': ['Madhya Pradesh', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Odisha', 'Jharkhand', 'Uttar Pradesh'],
  'Goa': ['Maharashtra', 'Karnataka'],
  'Gujarat': ['Rajasthan', 'Madhya Pradesh', 'Maharashtra'],
  'Haryana': ['Punjab', 'Himachal Pradesh', 'Rajasthan', 'Uttar Pradesh', 'Delhi'],
  'Himachal Pradesh': ['Punjab', 'Haryana', 'Uttarakhand', 'Jammu & Kashmir', 'Ladakh'],
  'Jharkhand': ['Bihar', 'West Bengal', 'Odisha', 'Chhattisgarh', 'Uttar Pradesh'],
  'Karnataka': ['Goa', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Tamil Nadu', 'Kerala'],
  'Kerala': ['Karnataka', 'Tamil Nadu', 'Puducherry'],
  'Madhya Pradesh': ['Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Chhattisgarh', 'Maharashtra'],
  'Maharashtra': ['Gujarat', 'Madhya Pradesh', 'Chhattisgarh', 'Telangana', 'Karnataka', 'Goa'],
  'Manipur': ['Nagaland', 'Assam', 'Mizoram'],
  'Meghalaya': ['Assam'],
  'Mizoram': ['Tripura', 'Assam', 'Manipur'],
  'Nagaland': ['Assam', 'Arunachal Pradesh', 'Manipur'],
  'Odisha': ['West Bengal', 'Jharkhand', 'Chhattisgarh', 'Andhra Pradesh'],
  'Punjab': ['Jammu & Kashmir', 'Himachal Pradesh', 'Haryana', 'Rajasthan'],
  'Rajasthan': ['Punjab', 'Haryana', 'Uttar Pradesh', 'Madhya Pradesh', 'Gujarat'],
  'Sikkim': ['West Bengal'],
  'Tamil Nadu': ['Kerala', 'Karnataka', 'Andhra Pradesh', 'Puducherry'],
  'Telangana': ['Maharashtra', 'Chhattisgarh', 'Karnataka', 'Andhra Pradesh'],
  'Tripura': ['Assam', 'Mizoram'],
  'Uttar Pradesh': ['Uttarakhand', 'Haryana', 'Delhi', 'Rajasthan', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Bihar'],
  'Uttarakhand': ['Himachal Pradesh', 'Haryana', 'Uttar Pradesh'],
  'West Bengal': ['Sikkim', 'Assam', 'Odisha', 'Jharkhand', 'Bihar'],
  'Delhi': ['Haryana', 'Uttar Pradesh'],
  'Puducherry': ['Tamil Nadu', 'Kerala', 'Andhra Pradesh'],
  'Jammu & Kashmir': ['Punjab', 'Himachal Pradesh', 'Ladakh'],
  'Ladakh': ['Jammu & Kashmir', 'Himachal Pradesh'],
})
