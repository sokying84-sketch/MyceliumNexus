
export type MushroomShape = 'CONVEX' | 'FLAT' | 'UPTURNED';

export interface BatchBaseline {
  targetDiameterCM: number;
  targetMaturationDays: number;
}

export interface SamplingInput {
  currentDate: Date;
  pinningDate: Date | null;
  currentAvgDiameterCM: number;
  dominantShape: MushroomShape;
  flatPercentage?: number; // 0-100
}

export interface NotificationAction {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  recipient: 'VILLAGE_C' | 'WORKERS' | 'MANAGER';
  channel: 'EMAIL' | 'PUSH' | 'SMS_SYSTEM';
  message: string;
}

/**
 * Aggregates a list of samples to find the Mean Diameter, Dominant (Mode) Shape, and Flat Shape Percentage.
 * Tie-breaker rule: UPTURNED > FLAT > CONVEX
 */
export const aggregateSampleData = (samples: { diameter: number, shape: string }[]): { avgDiameter: number, dominantShape: MushroomShape, flatPercentage: number } => {
  if (samples.length === 0) return { avgDiameter: 0, dominantShape: 'CONVEX', flatPercentage: 0 };

  // 1. Calculate Average Diameter (Mean)
  const totalDia = samples.reduce((sum, s) => sum + (Number(s.diameter) || 0), 0);
  const avgDiameter = Number((totalDia / samples.length).toFixed(2));

  // 2. Calculate Dominant Shape (Mode) & Flat Percentage
  const counts: Record<string, number> = { CONVEX: 0, FLAT: 0, UPTURNED: 0 };
  let flatCount = 0;

  samples.forEach(s => {
    const shp = s.shape.toUpperCase();
    if (counts[shp] !== undefined) counts[shp]++;
    if (shp === 'FLAT') flatCount++;
  });

  const flatPercentage = (flatCount / samples.length) * 100;

  // Priority for tie-breaking: UPTURNED (3) > FLAT (2) > CONVEX (1)
  const priorities: Record<string, number> = { 'UPTURNED': 3, 'FLAT': 2, 'CONVEX': 1 };
  
  const sortedShapes = Object.keys(counts).sort((a, b) => {
      // First compare by frequency (descending)
      const countDiff = counts[b] - counts[a];
      if (countDiff !== 0) return countDiff;
      
      // If frequency tied, compare by priority (descending)
      return priorities[b] - priorities[a];
  });
  
  return { avgDiameter, dominantShape: sortedShapes[0] as MushroomShape, flatPercentage };
};

/**
 * Calculates Maturity Index (Max 90%) based on 3-Step Weighted Formula.
 * Weights: Size (40), Time (30), Flat Ratio (20).
 */
export const calculateMaturityIndex = (
  input: SamplingInput,
  baseline: BatchBaseline
): number => {
  const { currentDate, pinningDate, currentAvgDiameterCM, flatPercentage = 0 } = input;
  const { targetDiameterCM, targetMaturationDays } = baseline;

  // Step A: Time Component (Weight: 30)
  // Logic: (Days Elapsed / Target Days) * 30
  let timeScore = 0;
  if (pinningDate) {
      const timeDiff = currentDate.getTime() - pinningDate.getTime();
      const daysElapsed = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24))); 
      const safeTargetDays = targetMaturationDays > 0 ? targetMaturationDays : 5;
      const timeRatio = daysElapsed / safeTargetDays;
      timeScore = Math.min(timeRatio * 30, 30); // Cap at 30
  }

  // Step B: Size Component (Weight: 40)
  // Logic: (Current Diameter / Target Diameter) * 40
  const safeTargetDia = targetDiameterCM > 0 ? targetDiameterCM : 8.0;
  const sizeRatio = currentAvgDiameterCM / safeTargetDia;
  const sizeScore = Math.min(sizeRatio * 40, 40); // Cap at 40

  // Step C: Flat Ratio Component (Weight: 20)
  // Logic: Based on Flat Ratio brackets
  const flatRatio = flatPercentage / 100;
  let flatScore = 0;

  if (flatRatio < 0.2) {
      flatScore = 0; // Below 20%
  } else if (flatRatio >= 0.2 && flatRatio <= 0.6) {
      flatScore = 10; // 20% - 60% (Includes the 0.2-0.5 range and the 0.5-0.6 gap)
  } else if (flatRatio > 0.6) {
      flatScore = 20; // Over 60%
  }
  // Cap at 20 (redundant given logic but safe)
  flatScore = Math.min(flatScore, 20);

  // Final Calculation
  const totalCalculated = timeScore + sizeScore + flatScore;
  return Math.round(totalCalculated);
};

/**
 * Determines the text status based on the new Weighted Maturity Index.
 */
export const evaluateBatchStatus = (
  maturityIndex: number, 
  flatPercentage: number, // Unused in this specific logic version but kept for interface consistency
  hasPinningStarted: boolean
): string => {
    if (!hasPinningStarted) return 'Growing';
    
    // 3. Ready to Harvest (81% - 90+)
    if (maturityIndex >= 81) return 'Ready to Harvest';

    // 2. Approaching Maturity (61% - 80%)
    if (maturityIndex >= 61 && maturityIndex <= 80) return 'Approaching Maturity';

    // 1. Growing (0% - 60%)
    return 'Growing';
};

/**
 * Evaluates the calculated maturity index against thresholds to determine notification actions.
 */
export const evaluateHarvestStatus = (
  maturityIndex: number, 
  flatPercentage: number,
  batchId: string
): NotificationAction | null => {
  // Adjusted for new Max Score of 90
  
  if (maturityIndex >= 81) {
    return {
      level: 'WARNING',
      recipient: 'WORKERS',
      channel: 'PUSH',
      message: `TASK: Harvest Batch ${batchId} NOW. Maturity Index: ${maturityIndex}%`
    };
  } else if (maturityIndex >= 61) {
    return {
      level: 'INFO',
      recipient: 'VILLAGE_C',
      channel: 'EMAIL',
      message: `Heads Up: Batch ${batchId} approaching maturity (${maturityIndex}%).`
    };
  }
  
  return null;
};
