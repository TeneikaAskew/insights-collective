import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Star, MessageSquare, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RubricCriteria {
  assessment_area: string;
  criteria_description: string;
  performance_level: string;
  score: number;
}

interface PeerReview {
  id?: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rubric_scores: Record<string, number>;
  notes?: string;
  created_at?: string;
  reviewer_profile?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface AssessmentSession {
  id: string;
  user_id: string;
  session_name?: string;
  status: 'in_progress' | 'completed' | 'pending_review';
  start_time: string;
  end_time?: string;
  overall_score?: number;
}

interface PeerReviewSystemProps {
  sessionId: string;
  currentUserId: string;
  mode: 'review' | 'view_reviews';
}

const PeerReviewSystem: React.FC<PeerReviewSystemProps> = ({
  sessionId,
  currentUserId,
  mode
}) => {
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriteria[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [sessionData, setSessionData] = useState<AssessmentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [sessionId, mode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch session data
      const { data: session } = await supabase
        .from('assessment_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      setSessionData(session);

      // Fetch rubric criteria
      const { data: criteria } = await supabase
        .from('assesment_rubric')
        .select('*')
        .order('assessment_area');

      setRubricCriteria(criteria || []);

      if (mode === 'view_reviews') {
        // Fetch existing reviews for this session
        const { data: reviewsData } = await supabase
          .from('peer_reviews')
          .select(`
            *,
            reviewer_profile:profiles!reviewer_id(first_name, last_name, avatar_url)
          `)
          .eq('session_id', sessionId)
          .eq('reviewee_id', currentUserId);

        setReviews(reviewsData || []);
      } else {
        // Initialize scores for review mode
        const initialScores: Record<string, number> = {};
        criteria?.forEach(criterion => {
          initialScores[criterion.assessment_area] = 3; // Default to middle score
        });
        setScores(initialScores);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assessment data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (assessmentArea: string, value: number[]) => {
    setScores(prev => ({
      ...prev,
      [assessmentArea]: value[0]
    }));
  };

  const handleSubmitReview = async () => {
    if (!user || !sessionData) return;

    // Validate that all criteria have been scored
    const missingScores = rubricCriteria.filter(
      criterion => !(criterion.assessment_area in scores)
    );

    if (missingScores.length > 0) {
      toast({
        title: 'Error',
        description: 'Please score all assessment criteria',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        session_id: sessionId,
        reviewer_id: user.id,
        reviewee_id: sessionData.user_id,
        rubric_scores: scores,
        notes: notes.trim() || null
      };

      const { error } = await supabase
        .from('peer_reviews')
        .insert(reviewData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Review submitted successfully'
      });

      // Reset form
      setNotes('');
      const initialScores: Record<string, number> = {};
      rubricCriteria.forEach(criterion => {
        initialScores[criterion.assessment_area] = 3;
      });
      setScores(initialScores);

    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4.5) return 'Excellent';
    if (score >= 3.5) return 'Good';
    if (score >= 2.5) return 'Satisfactory';
    if (score >= 1.5) return 'Needs Improvement';
    return 'Poor';
  };

  const calculateAverageScore = (reviews: PeerReview[], area: string) => {
    const scores = reviews
      .map(review => review.rubric_scores[area])
      .filter(score => score !== undefined);
    
    if (scores.length === 0) return null;
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'view_reviews') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5" />
              <span>Peer Review Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No reviews available yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Reviews will appear here once your peers complete their assessments
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overall Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {reviews.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Reviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(() => {
                        const allScores = reviews.flatMap(r => Object.values(r.rubric_scores));
                        const avg = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
                        return avg.toFixed(1);
                      })()}
                    </div>
                    <div className="text-sm text-gray-600">Average Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {(() => {
                        const allScores = reviews.flatMap(r => Object.values(r.rubric_scores));
                        const avg = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
                        return getScoreLabel(avg);
                      })()}
                    </div>
                    <div className="text-sm text-gray-600">Overall Rating</div>
                  </div>
                </div>

                {/* Detailed Scores by Criteria */}
                <div>
                  <h4 className="font-medium mb-4">Scores by Assessment Area</h4>
                  <div className="space-y-4">
                    {rubricCriteria.map(criterion => {
                      const avgScore = calculateAverageScore(reviews, criterion.assessment_area);
                      return (
                        <div key={criterion.assessment_area} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-medium">{criterion.assessment_area}</h5>
                            {avgScore !== null && (
                              <Badge variant="outline" className={getScoreColor(avgScore)}>
                                {avgScore.toFixed(1)} / 5
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {criterion.criteria_description}
                          </p>
                          {avgScore !== null && (
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${(avgScore / 5) * 100}%` }}
                                />
                              </div>
                              <span className={`text-sm font-medium ${getScoreColor(avgScore)}`}>
                                {getScoreLabel(avgScore)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual Reviews */}
                <div>
                  <h4 className="font-medium mb-4">Individual Reviews</h4>
                  <div className="space-y-4">
                    {reviews.map(review => (
                      <Card key={review.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-3">
                            <UserCircle className="h-8 w-8 text-gray-400" />
                            <div>
                              <p className="font-medium">
                                {review.reviewer_profile?.first_name} {review.reviewer_profile?.last_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(review.created_at!).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {review.notes && (
                            <div className="mb-4">
                              <Label className="text-sm font-medium">Comments:</Label>
                              <p className="text-sm text-gray-700 mt-1 p-3 bg-gray-50 rounded">
                                {review.notes}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {Object.entries(review.rubric_scores).map(([area, score]) => (
                              <div key={area} className="flex justify-between items-center">
                                <span className="text-gray-600">{area}:</span>
                                <Badge variant="outline" className={getScoreColor(score)}>
                                  {score} / 5
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review mode
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>Peer Review Assessment</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sessionData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-1">Assessment Session</h4>
            <p className="text-blue-700 text-sm">
              {sessionData.session_name || `Session ${sessionData.id.slice(0, 8)}`}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {rubricCriteria.map(criterion => (
            <div key={criterion.assessment_area} className="border rounded-lg p-4">
              <div className="mb-4">
                <h4 className="font-medium text-lg">{criterion.assessment_area}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {criterion.criteria_description}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Score (1-5)</Label>
                  <Badge variant="outline" className={getScoreColor(scores[criterion.assessment_area] || 3)}>
                    {scores[criterion.assessment_area] || 3} / 5 - {getScoreLabel(scores[criterion.assessment_area] || 3)}
                  </Badge>
                </div>
                <Slider
                  value={[scores[criterion.assessment_area] || 3]}
                  onValueChange={(value) => handleScoreChange(criterion.assessment_area, value)}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Poor (1)</span>
                  <span>Satisfactory (3)</span>
                  <span>Excellent (5)</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label htmlFor="notes">Additional Comments (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Provide constructive feedback..."
            rows={4}
            className="mt-2"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button
            onClick={handleSubmitReview}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PeerReviewSystem;