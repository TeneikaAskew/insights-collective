
export const BULLET_CATEGORIES = {
  xyz_scores: {
    action: {
      color: '#818CF8', // indigo-400
      label: 'Action Words',
      maxValue: 10
    },
    metrics: {
      color: '#34D399', // emerald-400
      label: 'Metrics/Results',
      maxValue: 30
    },
    clarity: {
      color: '#60A5FA', // blue-400
      label: 'Clarity/Conciseness',
      maxValue: 15
    },
    industry: {
      color: '#A78BFA', // violet-400
      label: 'Industry Keywords',
      maxValue: 25
    },
    achievement: {
      color: '#F472B6', // pink-400
      label: 'Achievement',
      maxValue: 20
    }
  },
  word_balance: {
    industry_pct: {
      color: '#8B5CF6', // violet-500
      label: 'Industry',
      maxValue: 100
    },
    common_pct: {
      color: '#6B7280', // gray-500
      label: 'Common',
      maxValue: 100
    },
    action_pct: {
      color: '#3B82F6', // blue-500
      label: 'Action',
      maxValue: 100
    },
    metric_pct: {
      color: '#10B981', // emerald-500
      label: 'Metric',
      maxValue: 100
    }
  }
};

export function prepareBulletChartData(bullet: any) {
  if (!bullet) {
    return { dataWithPercent: [], bullet_total: 0 };
  }

  // Initialize charts data
  const bulletTotal = bullet.bullet_total || 0;
  const wordBalanceScore = bullet.word_balance_score || 0; 
  const xyzScores = bullet.xyz_scores || {};
  const wordBalances = bullet.word_balance || {};

  // Prepare XYZ scores data
  const xyzData = Object.entries(BULLET_CATEGORIES.xyz_scores).map(([key, config]) => {
    const value = xyzScores[key] || 0;
    const maxValue = config.maxValue;
    const percent = Math.round((value / maxValue) * 100);
    
    return {
      name: config.label,
      value,
      maxValue,
      color: config.color,
      percent
    };
  });

  // Prepare word balance data
  const wordBalanceData = Object.entries(BULLET_CATEGORIES.word_balance).map(([key, config]) => {
    const value = wordBalances[key] || 0;
    
    return {
      name: config.label,
      value,
      color: config.color,
      percent: Math.round(value)
    };
  });

  // Combine both datasets
  const combinedData = [...xyzData, ...wordBalanceData];
  
  return {
    dataWithPercent: combinedData,
    bullet_total: bulletTotal,
    wordBalanceScore
  };
}
