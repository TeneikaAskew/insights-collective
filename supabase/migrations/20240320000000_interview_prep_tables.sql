-- Create job descriptions table
CREATE TABLE job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    source_type TEXT CHECK (source_type IN ('manual', 'url')),
    source_url TEXT,
    raw_text TEXT NOT NULL,
    parsed_fields JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT valid_source CHECK (
        (source_type = 'manual' AND source_url IS NULL) OR
        (source_type = 'url' AND source_url IS NOT NULL)
    )
);

-- Create study guides table
CREATE TABLE study_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_description_id UUID REFERENCES job_descriptions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    competencies JSONB,
    questions JSONB,
    technical_checklist JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create STAR responses table
CREATE TABLE star_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID,
    user_id UUID REFERENCES auth.users(id),
    situation TEXT,
    task TEXT,
    action TEXT,
    result TEXT,
    ai_feedback JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create code challenges table
CREATE TABLE code_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    test_cases JSONB,
    topic_tags TEXT[],
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create code attempts table
CREATE TABLE code_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    challenge_id UUID REFERENCES code_challenges(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    duration INTEGER, -- in seconds
    passed_tests BOOLEAN,
    ai_review JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create availability slots table
CREATE TABLE availability_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),
    time_block TEXT CHECK (time_block IN ('morning', 'afternoon', 'evening')),
    is_available BOOLEAN DEFAULT false,
    UNIQUE (user_id, weekday, time_block)
);

-- Create mock interview sessions table
CREATE TABLE mock_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES auth.users(id),
    user2_id UUID REFERENCES auth.users(id),
    role1 TEXT CHECK (role1 IN ('interviewer', 'interviewee')),
    role2 TEXT CHECK (role2 IN ('interviewer', 'interviewee')),
    session_time TIMESTAMP WITH TIME ZONE,
    type TEXT CHECK (type IN ('behavioral', 'technical')),
    status TEXT CHECK (status IN ('scheduled', 'completed', 'canceled')),
    study_guide_id UUID REFERENCES study_guides(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create peer reviews table
CREATE TABLE peer_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES mock_sessions(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES auth.users(id),
    reviewee_id UUID REFERENCES auth.users(id),
    rubric_scores JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create RLS policies
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;

-- Job descriptions policies
CREATE POLICY "Users can view their own job descriptions"
    ON job_descriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job descriptions"
    ON job_descriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job descriptions"
    ON job_descriptions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job descriptions"
    ON job_descriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Study guides policies
CREATE POLICY "Users can view their own study guides"
    ON study_guides FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study guides"
    ON study_guides FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study guides"
    ON study_guides FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- STAR responses policies
CREATE POLICY "Users can view their own STAR responses"
    ON star_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own STAR responses"
    ON star_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own STAR responses"
    ON star_responses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Code challenges policies
CREATE POLICY "Everyone can view code challenges"
    ON code_challenges FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage code challenges"
    ON code_challenges FOR ALL
    USING (auth.uid() IN (SELECT id FROM auth.users WHERE is_admin = true));

-- Code attempts policies
CREATE POLICY "Users can view their own code attempts"
    ON code_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own code attempts"
    ON code_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Availability slots policies
CREATE POLICY "Users can manage their own availability"
    ON availability_slots FOR ALL
    USING (auth.uid() = user_id);

-- Mock sessions policies
CREATE POLICY "Users can view sessions they're part of"
    ON mock_sessions FOR SELECT
    USING (auth.uid() IN (user1_id, user2_id));

CREATE POLICY "Users can create sessions"
    ON mock_sessions FOR INSERT
    WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Users can update sessions they're part of"
    ON mock_sessions FOR UPDATE
    USING (auth.uid() IN (user1_id, user2_id));

-- Peer reviews policies
CREATE POLICY "Users can view reviews they're involved in"
    ON peer_reviews FOR SELECT
    USING (auth.uid() IN (reviewer_id, reviewee_id));

CREATE POLICY "Users can create reviews for their sessions"
    ON peer_reviews FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id); 