-- Data Blueprint Course Migration
-- Converts the 10-part Data Blueprint blog series into a full LMS course
-- with modules, lesson pages, quizzes, and quiz questions.

DO $$
DECLARE
  v_instructor_id UUID;
  v_course_id UUID;
  v_module_id UUID;
  v_content_id UUID;
  v_quiz_content_id UUID;
  v_quiz_id UUID;
BEGIN
  -- Find instructor: prefer Nikki, fall back to any instructor, then any profile
  SELECT id INTO v_instructor_id FROM profiles
    WHERE first_name ILIKE '%Nikki%' OR last_name ILIKE '%Nikki%' LIMIT 1;
  IF v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id FROM profiles
      WHERE 'instructor' = ANY(roles) LIMIT 1;
  END IF;
  IF v_instructor_id IS NULL THEN
    SELECT id INTO v_instructor_id FROM profiles LIMIT 1;
  END IF;

  -- Idempotency: skip if course already exists
  SELECT id INTO v_course_id FROM courses WHERE title = 'Data Blueprint' LIMIT 1;
  IF v_course_id IS NOT NULL THEN
    RAISE NOTICE 'Data Blueprint course already exists, skipping.';
    RETURN;
  END IF;

  -- Create the course
  INSERT INTO courses (title, description, category, level, duration, tags, image_url, enrollment_status, published, status, instructor_id, difficulty_level, estimated_hours)
  VALUES (
    'Data Blueprint',
    'A comprehensive 10-module guide to breaking in, leveling up, and leading in data careers. Covers data science fundamentals, team roles, the data science lifecycle, career entry strategies, ethics, industry wisdom, tools, career paths, resume tips, and real-world case studies.',
    'Data Science',
    'Beginner',
    '10 weeks',
    ARRAY['Data Science','Career','Fundamentals','Data Blueprint'],
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000',
    'open',
    true,
    'published',
    v_instructor_id,
    'beginner',
    20.0
  ) RETURNING id INTO v_course_id;

  -- Assign instructor
  INSERT INTO course_instructors (course_id, user_id, role)
  VALUES (v_course_id, v_instructor_id, 'instructor');

  -- ============================================================
  -- MODULE 1: What Is Data Science?
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'What Is Data Science?', 'A deep dive into the definition, evolution, and real-world application of data science—from business intelligence to machine learning.', 1, 0, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'What Is Data Science?', $md$<h2>What Is Data Science?</h2>
<p>Data science is an interdisciplinary field that combines domain expertise, programming skills, and knowledge of mathematics and statistics to extract meaningful insights from data.</p>
<h3>The Evolution of Data Science</h3>
<p>Data science has evolved from statistics and data mining into a complex field that leverages advanced algorithms, computational methods, and infrastructure to analyze large datasets.</p>
<h3>Core Components</h3>
<ol>
<li><strong>Statistics and Mathematics</strong>: The foundation of data analysis</li>
<li><strong>Programming and Software Engineering</strong>: Tools to manipulate data</li>
<li><strong>Domain Knowledge</strong>: Understanding of the specific field</li>
<li><strong>Communication</strong>: Ability to explain insights to non-technical stakeholders</li>
</ol>
<h3>Real-World Applications</h3>
<p>Data science is transforming industries from healthcare to finance, enabling better decision-making through predictive analytics, recommendation systems, and automated processes.</p>
<h3>The Future of Data Science</h3>
<p>As AI and machine learning continue to advance, data science will play an increasingly crucial role in solving complex problems and driving innovation across industries.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 1 Quiz: What Is Data Science?', '<p>Test your understanding of data science fundamentals.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 1 Quiz: What Is Data Science?', 'Test your understanding of data science fundamentals.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'Data science is best described as which type of field?', 10, 0,
     '[{"id":"a","text":"A purely statistical field","correct":false},{"id":"b","text":"An interdisciplinary field combining math, programming, and domain knowledge","correct":true},{"id":"c","text":"A management discipline","correct":false},{"id":"d","text":"A software engineering specialty","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which of the following is NOT listed as a core component of data science?', 10, 1,
     '[{"id":"a","text":"Statistics and Mathematics","correct":false},{"id":"b","text":"Programming and Software Engineering","correct":false},{"id":"c","text":"Graphic Design","correct":true},{"id":"d","text":"Communication","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Data science evolved from which two earlier disciplines?', 10, 2,
     '[{"id":"a","text":"Web development and networking","correct":false},{"id":"b","text":"Statistics and data mining","correct":true},{"id":"c","text":"Gaming and computer graphics","correct":false},{"id":"d","text":"Physics and chemistry","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'Communication skills are essential in data science for explaining insights to non-technical stakeholders.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which of these is cited as a real-world application of data science?', 10, 4,
     '[{"id":"a","text":"Architectural blueprints","correct":false},{"id":"b","text":"Recommendation systems","correct":true},{"id":"c","text":"Industrial welding","correct":false},{"id":"d","text":"Interior design","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 2: Core Roles in a Data Team
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Core Roles in a Data Team', 'Explore the anatomy of a modern data team. Learn how analysts, data scientists, engineers, and product managers collaborate.', 2, 1, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Core Roles in a Data Team', $md$<h2>Core Roles in a Data Team</h2>
<p>A successful data team combines various specialized roles that collaborate to transform raw data into valuable insights and products.</p>
<h3>Data Analyst</h3>
<p>Data analysts focus on interpreting existing data using statistical methods and visualization tools to answer business questions and support decision-making.</p>
<h3>Data Scientist</h3>
<p>Data scientists develop advanced analytical models, algorithms, and predictive systems using machine learning and statistical methods to extract deeper insights from data.</p>
<h3>Data Engineer</h3>
<p>Data engineers build and maintain the infrastructure needed to store, process, and deliver data efficiently and reliably to the rest of the organization.</p>
<h3>Machine Learning Engineer</h3>
<p>ML engineers specialize in deploying models into production systems, ensuring they operate efficiently at scale while maintaining accuracy.</p>
<h3>Data Product Manager</h3>
<p>Data product managers guide the strategic direction of data initiatives, balancing technical capabilities with business requirements to deliver valuable outcomes.</p>
<h3>Collaboration Dynamics</h3>
<p>The most effective data teams maintain clear communication channels and collaborative workflows between these specialized roles, often using agile methodologies to deliver value incrementally.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 2 Quiz: Core Roles in a Data Team', '<p>Test your knowledge of data team roles and dynamics.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 2 Quiz: Core Roles in a Data Team', 'Test your knowledge of data team roles and dynamics.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'Which role is primarily responsible for building and maintaining data infrastructure?', 10, 0,
     '[{"id":"a","text":"Data Analyst","correct":false},{"id":"b","text":"Data Scientist","correct":false},{"id":"c","text":"Data Engineer","correct":true},{"id":"d","text":"Data Product Manager","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which role focuses on deploying ML models into production systems at scale?', 10, 1,
     '[{"id":"a","text":"Data Analyst","correct":false},{"id":"b","text":"Data Scientist","correct":false},{"id":"c","text":"Machine Learning Engineer","correct":true},{"id":"d","text":"Data Engineer","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which role balances technical capabilities with business requirements for data initiatives?', 10, 2,
     '[{"id":"a","text":"Data Analyst","correct":false},{"id":"b","text":"Data Scientist","correct":false},{"id":"c","text":"Machine Learning Engineer","correct":false},{"id":"d","text":"Data Product Manager","correct":true}]'::jsonb),
    (v_quiz_id, 'true_false', 'Data analysts primarily develop advanced machine learning algorithms.', 10, 3,
     '[{"id":"true","text":"True","correct":false},{"id":"false","text":"False","correct":true}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What methodology do effective data teams commonly use to deliver value incrementally?', 10, 4,
     '[{"id":"a","text":"Waterfall","correct":false},{"id":"b","text":"Agile","correct":true},{"id":"c","text":"Six Sigma","correct":false},{"id":"d","text":"Lean manufacturing","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 3: The Data Science Lifecycle
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'The Data Science Lifecycle', 'From problem framing to data collection, modeling, and monitoring—get familiar with the iterative workflow that powers every successful data science initiative.', 3, 2, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'The Data Science Lifecycle', $md$<h2>The Data Science Lifecycle</h2>
<p>The data science lifecycle is an iterative process that guides projects from initial business understanding to deployment and ongoing monitoring.</p>
<h3>1. Problem Framing</h3>
<p>Clearly defining the business problem and translating it into a data science problem with measurable objectives and success criteria.</p>
<h3>2. Data Acquisition and Understanding</h3>
<p>Gathering, exploring, and preparing the data needed to solve the problem, including cleaning, transformation, and feature engineering.</p>
<h3>3. Modeling</h3>
<p>Developing and evaluating various analytical models to find the approach that best addresses the defined problem.</p>
<h3>4. Deployment</h3>
<p>Implementing the chosen solution in a production environment where it can deliver value to end-users or business processes.</p>
<h3>5. Monitoring and Maintenance</h3>
<p>Continuously tracking model performance, retraining as needed, and ensuring the solution remains relevant as business conditions change.</p>
<h3>The Iterative Nature</h3>
<p>Data science is rarely linear—teams often move back and forth between these stages as they gain new insights or encounter challenges.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 3 Quiz: The Data Science Lifecycle', '<p>Test your knowledge of the data science lifecycle stages.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 3 Quiz: The Data Science Lifecycle', 'Test your knowledge of the data science lifecycle stages.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'What is the first stage of the data science lifecycle?', 10, 0,
     '[{"id":"a","text":"Modeling","correct":false},{"id":"b","text":"Problem Framing","correct":true},{"id":"c","text":"Deployment","correct":false},{"id":"d","text":"Monitoring","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which stage involves cleaning, transformation, and feature engineering?', 10, 1,
     '[{"id":"a","text":"Problem Framing","correct":false},{"id":"b","text":"Data Acquisition and Understanding","correct":true},{"id":"c","text":"Modeling","correct":false},{"id":"d","text":"Deployment","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What comes after Deployment in the data science lifecycle?', 10, 2,
     '[{"id":"a","text":"Problem Framing","correct":false},{"id":"b","text":"Modeling","correct":false},{"id":"c","text":"Monitoring and Maintenance","correct":true},{"id":"d","text":"Data Acquisition","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'The data science lifecycle is strictly linear and teams never revisit earlier stages.', 10, 3,
     '[{"id":"true","text":"True","correct":false},{"id":"false","text":"False","correct":true}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What does the Modeling stage aim to do?', 10, 4,
     '[{"id":"a","text":"Clean the data","correct":false},{"id":"b","text":"Develop and evaluate analytical models","correct":true},{"id":"c","text":"Deploy to production","correct":false},{"id":"d","text":"Frame the business problem","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 4: How to Start a Career in Data Science
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'How to Start a Career in Data Science', 'This module breaks down the key entry points, essential skills, portfolio strategies, and mindset shifts to launch your career with confidence.', 4, 3, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'How to Start a Career in Data Science', $md$<h2>How to Start a Career in Data Science</h2>
<p>Breaking into data science requires a combination of technical skills, practical experience, and strategic career planning.</p>
<h3>Education Paths</h3>
<h4>Academic Degrees</h4>
<p>Formal education in computer science, statistics, mathematics, or specialized data science programs provides a strong theoretical foundation.</p>
<h4>Bootcamps</h4>
<p>Intensive, focused training programs offer accelerated learning and project experience, often with career support.</p>
<h4>Self-Teaching</h4>
<p>With quality online resources, motivated learners can acquire skills at their own pace while building projects that demonstrate their abilities.</p>
<h3>Essential Skills to Develop</h3>
<ol>
<li><strong>Programming</strong>: Python and/or R, SQL</li>
<li><strong>Statistics and Mathematics</strong>: Probability, linear algebra, calculus</li>
<li><strong>Machine Learning</strong>: Understanding algorithms and their applications</li>
<li><strong>Data Manipulation and Visualization</strong>: Working with messy data and communicating insights</li>
<li><strong>Domain Knowledge</strong>: Understanding of a specific industry or field</li>
</ol>
<h3>Building a Portfolio</h3>
<p>Create projects that showcase your skills and problem-solving approach, ideally addressing real-world challenges in domains that interest you.</p>
<h3>Networking and Community</h3>
<p>Engage with the data science community through meetups, conferences, online forums, and social media to learn and find opportunities.</p>
<h3>Landing Your First Role</h3>
<p>Consider starting with internships, entry-level analyst positions, or contributing to open-source projects to build experience that will help you transition into more specialized data science roles.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 4 Quiz: Starting a Data Science Career', '<p>Test your knowledge of career entry strategies.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 4 Quiz: Starting a Data Science Career', 'Test your knowledge of career entry strategies.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'Which of the following is NOT mentioned as a common entry path into data science?', 10, 0,
     '[{"id":"a","text":"Academic degrees","correct":false},{"id":"b","text":"Bootcamps","correct":false},{"id":"c","text":"Self-teaching","correct":false},{"id":"d","text":"Door-to-door sales","correct":true}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which programming languages are recommended as essential for data science?', 10, 1,
     '[{"id":"a","text":"Python and/or R, and SQL","correct":true},{"id":"b","text":"C++ and Assembly","correct":false},{"id":"c","text":"Java and PHP","correct":false},{"id":"d","text":"HTML and CSS","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What is the primary purpose of building a portfolio?', 10, 2,
     '[{"id":"a","text":"To earn academic credits","correct":false},{"id":"b","text":"To showcase skills and problem-solving through real-world projects","correct":true},{"id":"c","text":"To replace a resume entirely","correct":false},{"id":"d","text":"To avoid networking","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'Networking through meetups and communities is recommended for finding data science opportunities.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which is suggested as a starting role to gain data science experience?', 10, 4,
     '[{"id":"a","text":"Chief Technology Officer","correct":false},{"id":"b","text":"Entry-level analyst positions","correct":true},{"id":"c","text":"Senior principal data scientist","correct":false},{"id":"d","text":"VP of Engineering","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 5: Responsible AI & Ethics in Data Science
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Responsible AI & Ethics in Data Science', 'Explore the ethical considerations behind model development. Learn the principles, tools, and team dynamics that make AI not just smart, but responsible.', 5, 4, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Responsible AI & Ethics in Data Science', $md$<h2>Responsible AI &amp; Ethics in Data Science</h2>
<p>As AI systems increasingly impact critical aspects of society, ethical considerations must be central to data science work.</p>
<h3>Key Ethical Challenges</h3>
<h4>Bias and Fairness</h4>
<p>AI systems can perpetuate or amplify existing societal biases if not carefully designed and monitored.</p>
<h4>Transparency and Explainability</h4>
<p>Complex models must be interpretable enough for stakeholders to understand how decisions are made.</p>
<h4>Privacy and Data Rights</h4>
<p>Balancing the benefits of data-driven insights with individuals' rights to privacy and control over their information.</p>
<h4>Accountability</h4>
<p>Establishing clear responsibility frameworks for AI system outcomes and impacts.</p>
<h3>Practical Approaches</h3>
<h4>Diverse Teams</h4>
<p>Including varied perspectives in AI development helps identify potential ethical issues earlier.</p>
<h4>Ethics by Design</h4>
<p>Incorporating ethical considerations from the beginning of projects rather than as an afterthought.</p>
<h4>Rigorous Testing</h4>
<p>Evaluating models for fairness across different demographic groups and scenarios.</p>
<h4>Ongoing Monitoring</h4>
<p>Continuously assessing deployed models for emerging ethical concerns as data and society evolve.</p>
<h3>Organizational Structures</h3>
<p>Building ethics committees, review processes, and documentation requirements that ensure responsible practices throughout the AI lifecycle.</p>
<h3>Regulatory Landscape</h3>
<p>Staying informed about evolving regulations like GDPR, the EU AI Act, and industry-specific requirements that govern AI development and deployment.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 5 Quiz: Responsible AI & Ethics', '<p>Test your understanding of AI ethics and responsible practices.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 5 Quiz: Responsible AI & Ethics', 'Test your understanding of AI ethics and responsible practices.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'What is one of the main ethical challenges with AI systems?', 10, 0,
     '[{"id":"a","text":"They run too slowly","correct":false},{"id":"b","text":"They can perpetuate or amplify existing societal biases","correct":true},{"id":"c","text":"They use too much electricity","correct":false},{"id":"d","text":"They cost too much to build","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which regulation is mentioned as part of the AI regulatory landscape?', 10, 1,
     '[{"id":"a","text":"HIPAA","correct":false},{"id":"b","text":"GDPR and EU AI Act","correct":true},{"id":"c","text":"SOX","correct":false},{"id":"d","text":"GAAP","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What is Ethics by Design?', 10, 2,
     '[{"id":"a","text":"Incorporating ethical considerations from the beginning of projects","correct":true},{"id":"b","text":"Only adding ethics review at the end","correct":false},{"id":"c","text":"Ignoring ethics during prototyping","correct":false},{"id":"d","text":"Hiring ethicists after deployment","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'Diverse teams can help identify potential ethical issues earlier in AI development.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Why should complex models be interpretable?', 10, 4,
     '[{"id":"a","text":"To make them run faster","correct":false},{"id":"b","text":"So stakeholders understand how decisions are made","correct":true},{"id":"c","text":"To reduce memory usage","correct":false},{"id":"d","text":"To increase prediction accuracy","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 6: Wisdom From the Field – Career Lessons
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Wisdom From the Field – Career Lessons', 'Hear from top data scientists across LinkedIn, Airbnb, and Google. This module curates their most powerful lessons on failure, communication, impact, and lifelong learning.', 6, 5, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Wisdom From the Field – Career Lessons', $md$<h2>Wisdom From the Field – Career Lessons</h2>
<p>Experienced data scientists share insights gained through years of solving complex problems across various industries.</p>
<h3>Communication Is Everything</h3>
<blockquote><p>"Technical brilliance means little if you can't explain your work to decision-makers. I spend more time improving my communication skills than learning new algorithms." — Former Google Data Scientist</p></blockquote>
<h3>Business Impact Matters More Than Model Complexity</h3>
<blockquote><p>"The simplest model that solves the business problem is almost always better than a complex state-of-the-art approach that's difficult to maintain." — Airbnb Director of Data Science</p></blockquote>
<h3>Embrace Failure As Learning</h3>
<blockquote><p>"My biggest breakthroughs came after acknowledging what wasn't working. Failing fast and documenting why is more valuable than persisting with a flawed approach." — LinkedIn Principal Data Scientist</p></blockquote>
<h3>Balance Depth and Breadth</h3>
<blockquote><p>"T-shaped skills—deep expertise in one area combined with broader knowledge across the field—make you more adaptable and valuable as data science evolves." — FAANG Tech Lead</p></blockquote>
<h3>Data Quality Trumps Sophisticated Modeling</h3>
<blockquote><p>"I've learned to spend 80% of my time ensuring data quality and understanding its limitations. The best model can't overcome fundamentally flawed inputs." — Healthcare Analytics Director</p></blockquote>
<h3>Continuous Learning Is Non-Negotiable</h3>
<blockquote><p>"The field changes so rapidly that continuous learning isn't optional. Build a personal curriculum that includes both fundamentals and emerging techniques." — Fintech Chief Data Officer</p></blockquote>
<h3>Build Cross-Functional Relationships</h3>
<blockquote><p>"My most successful projects weren't just technically sound but had strong champions across product, engineering, and business teams." — Retail Data Science Manager</p></blockquote>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 6 Quiz: Career Wisdom', '<p>Test your understanding of career lessons from data science leaders.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 6 Quiz: Career Wisdom', 'Test your understanding of career lessons from data science leaders.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'According to the Healthcare Analytics Director, what percentage of time is spent on data quality?', 10, 0,
     '[{"id":"a","text":"20%","correct":false},{"id":"b","text":"50%","correct":false},{"id":"c","text":"80%","correct":true},{"id":"d","text":"100%","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What does a T-shaped skill set mean?', 10, 1,
     '[{"id":"a","text":"Only technical skills","correct":false},{"id":"b","text":"Deep expertise in one area combined with broader knowledge","correct":true},{"id":"c","text":"Only management experience","correct":false},{"id":"d","text":"Skills limited to a single tool","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'The simplest model that solves the problem is often better than a complex state-of-the-art approach.', 10, 2,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What is the top lesson shared by the Former Google Data Scientist?', 10, 3,
     '[{"id":"a","text":"Learn new algorithms faster","correct":false},{"id":"b","text":"Communication is everything","correct":true},{"id":"c","text":"Hire more engineers","correct":false},{"id":"d","text":"Buy better hardware","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What is emphasized as non-negotiable for data science careers?', 10, 4,
     '[{"id":"a","text":"Working weekends","correct":false},{"id":"b","text":"Continuous learning","correct":true},{"id":"c","text":"Using only one programming language","correct":false},{"id":"d","text":"Avoiding collaboration","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 7: Tools of the Trade
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Tools of the Trade', 'Build your data science toolkit with the languages, libraries, and platforms used by the pros. From Python and SQL to MLflow and Streamlit.', 7, 6, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Tools of the Trade', $md$<h2>Tools of the Trade</h2>
<p>The right tools can dramatically enhance a data scientist's productivity and capabilities.</p>
<h3>Programming Languages</h3>
<h4>Python</h4>
<p>The most widely-used language in data science, with extensive libraries for data manipulation, analysis, and machine learning.</p>
<h4>R</h4>
<p>Especially powerful for statistical analysis and data visualization, with a rich ecosystem of packages.</p>
<h4>SQL</h4>
<p>Essential for working with relational databases and performing data extraction and manipulation.</p>
<h3>Data Manipulation and Analysis</h3>
<h4>Pandas</h4>
<p>The workhorse library for data handling in Python, enabling efficient operations on structured data.</p>
<h4>NumPy</h4>
<p>Fundamental for numerical computing, providing support for large, multi-dimensional arrays and matrices.</p>
<h3>Machine Learning</h3>
<h4>Scikit-learn</h4>
<p>Python's comprehensive library for classical machine learning algorithms and preprocessing techniques.</p>
<h4>TensorFlow/PyTorch</h4>
<p>Leading frameworks for deep learning and neural networks, supporting both research and production.</p>
<h4>XGBoost/LightGBM</h4>
<p>Powerful gradient boosting frameworks that excel in many practical machine learning tasks.</p>
<h3>Visualization</h3>
<h4>Matplotlib/Seaborn</h4>
<p>Python libraries for creating static, animated, and interactive visualizations.</p>
<h4>Tableau/PowerBI</h4>
<p>Business intelligence tools that enable interactive dashboarding and exploration.</p>
<h3>MLOps and Deployment</h3>
<h4>MLflow</h4>
<p>End-to-end platform for managing the machine learning lifecycle, from experimentation to deployment.</p>
<h4>Streamlit</h4>
<p>Framework for quickly creating and sharing data applications with minimal code.</p>
<h4>Docker</h4>
<p>Containerization tool that ensures consistency across development and production environments.</p>
<h3>Collaboration and Version Control</h3>
<h4>Git/GitHub</h4>
<p>Essential for code versioning, collaboration, and project management.</p>
<h4>Jupyter Notebooks</h4>
<p>Interactive computing environment that combines code, outputs, and documentation.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 7 Quiz: Tools of the Trade', '<p>Test your knowledge of data science tools and technologies.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 7 Quiz: Tools of the Trade', 'Test your knowledge of data science tools and technologies.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'Which Python library is the workhorse for data handling and structured data operations?', 10, 0,
     '[{"id":"a","text":"NumPy","correct":false},{"id":"b","text":"Pandas","correct":true},{"id":"c","text":"Matplotlib","correct":false},{"id":"d","text":"Scikit-learn","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which of these is a leading framework for deep learning and neural networks?', 10, 1,
     '[{"id":"a","text":"Pandas","correct":false},{"id":"b","text":"PyTorch","correct":true},{"id":"c","text":"Seaborn","correct":false},{"id":"d","text":"SQL","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What is the primary purpose of Docker in a data science toolkit?', 10, 2,
     '[{"id":"a","text":"Data visualization","correct":false},{"id":"b","text":"Containerization for consistency across environments","correct":true},{"id":"c","text":"Statistical analysis","correct":false},{"id":"d","text":"Version control","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'SQL is essential for working with relational databases in data science.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which tool is described as an end-to-end platform for managing the ML lifecycle?', 10, 4,
     '[{"id":"a","text":"Git","correct":false},{"id":"b","text":"MLflow","correct":true},{"id":"c","text":"Pandas","correct":false},{"id":"d","text":"Tableau","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 8: Data Science Career Paths
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Data Science Career Paths', 'Map out your growth. Whether you aspire to stay technical, lead teams, specialize in ML, or pivot into product, this guide lays out real-world trajectories.', 8, 7, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Data Science Career Paths', $md$<h2>Data Science Career Paths</h2>
<p>Data science offers diverse career trajectories that can evolve based on your interests, strengths, and goals.</p>
<h3>The Technical Specialist Path</h3>
<p><strong>Starting Point: Junior Data Scientist</strong> — Building foundational skills across data handling, modeling, and domain knowledge.</p>
<p><strong>Mid-Career: Senior Data Scientist</strong> — Developing deeper expertise, mentoring juniors, and leading complex projects.</p>
<p><strong>Advanced: Principal Data Scientist</strong> — Defining technical direction, solving the most challenging problems, and influencing organization-wide data strategy.</p>
<h3>The Management Path</h3>
<p>Moving from Senior Data Scientist to Data Science Manager, then Director or VP of Data Science—balancing tactical execution with strategic planning and managing multiple teams.</p>
<h3>The Machine Learning Engineering Path</h3>
<p>Combining statistical knowledge with software development practices to specialize in productionizing and scaling models in real-world systems.</p>
<h3>The Product-Focused Path</h3>
<p>Working closely with product teams as a Data Product Manager, leading the development of data-powered features or standalone data products.</p>
<h3>The Research Path</h3>
<p>Applying rigorous research methodologies to business problems, focusing on developing novel methods and applications, often publishing findings.</p>
<h3>Crossover Opportunities</h3>
<ul>
<li>AI Ethics and Governance</li>
<li>Data Strategy and Consulting</li>
<li>Data-Focused Entrepreneurship</li>
<li>Developer Advocacy and Education</li>
</ul>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 8 Quiz: Career Paths', '<p>Test your understanding of data science career trajectories.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 8 Quiz: Career Paths', 'Test your understanding of data science career trajectories.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'What is the advanced role on the Technical Specialist Path?', 10, 0,
     '[{"id":"a","text":"Junior Data Scientist","correct":false},{"id":"b","text":"Data Engineer","correct":false},{"id":"c","text":"Principal Data Scientist","correct":true},{"id":"d","text":"Data Analyst","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which career path focuses on productionizing and scaling models?', 10, 1,
     '[{"id":"a","text":"Research Path","correct":false},{"id":"b","text":"Management Path","correct":false},{"id":"c","text":"Machine Learning Engineering Path","correct":true},{"id":"d","text":"Product-Focused Path","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'The Product-Focused Path leads to which role?', 10, 2,
     '[{"id":"a","text":"Data Analyst","correct":false},{"id":"b","text":"Data Product Manager","correct":true},{"id":"c","text":"Software Engineer","correct":false},{"id":"d","text":"UX Designer","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'AI Ethics and Governance is listed as a crossover opportunity for data science professionals.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What does the Management Path balance?', 10, 4,
     '[{"id":"a","text":"Hardware and software","correct":false},{"id":"b","text":"Tactical execution and strategic planning","correct":true},{"id":"c","text":"Research and teaching","correct":false},{"id":"d","text":"Writing and reading","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 9: Resume & Portfolio Tips
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Resume & Portfolio Tips', 'Your resume gets you the interview. Your portfolio gets you the job. Learn how to craft results-driven bullet points, showcase real-world projects, and stand out.', 9, 8, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Resume & Portfolio Tips', $md$<h2>Resume &amp; Portfolio Tips for Data Scientists</h2>
<p>In a competitive field, effectively showcasing your skills and accomplishments is crucial for career advancement.</p>
<h3>Resume Strategies</h3>
<h4>Focus on Impact</h4>
<p>Transform technical descriptions into business results. Instead of "Built a regression model using scikit-learn," write "Increased customer retention by 15% by developing a predictive churn model."</p>
<h4>Quantify Whenever Possible</h4>
<p>Include metrics that demonstrate the significance of your work, such as "Improved model accuracy from 82% to 91% while reducing inference time by 30%."</p>
<h4>Highlight Relevant Technical Skills</h4>
<p>Create a concise, scannable section for your technical toolkit: languages, libraries/frameworks, and tools.</p>
<h4>Tailor for Automated Systems</h4>
<p>Incorporate relevant keywords from job descriptions to pass Applicant Tracking Systems (ATS).</p>
<h3>Portfolio Development</h3>
<h4>Select Diverse Projects</h4>
<p>Include 3-5 projects that demonstrate different skills: a machine learning model, a data visualization, a data engineering pipeline, and a dataset exploration.</p>
<h4>Structure Each Project</h4>
<ol>
<li>Problem statement and objectives</li>
<li>Data sources and preparation approach</li>
<li>Methodology and technical choices</li>
<li>Results and business implications</li>
<li>Challenges and how you overcame them</li>
<li>Future improvements</li>
</ol>
<h4>Show Your Work</h4>
<p>Make code repositories public on GitHub with clean, well-commented code, thorough README files, and documentation of your process.</p>
<h3>Interview Preparation</h3>
<p>Use your portfolio as interview preparation by practicing explaining technical concepts in simple terms and preparing stories about collaboration and problem-solving.</p>
<h3>Continuous Improvement</h3>
<p>Regularly update your portfolio with new skills and projects, highlighting your growth and adaptability in this rapidly evolving field.</p>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 9 Quiz: Resume & Portfolio', '<p>Test your knowledge of resume and portfolio best practices.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 9 Quiz: Resume & Portfolio', 'Test your knowledge of resume and portfolio best practices.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'What does Focus on Impact mean for resume writing?', 10, 0,
     '[{"id":"a","text":"Use bigger fonts","correct":false},{"id":"b","text":"Transform technical descriptions into business results","correct":true},{"id":"c","text":"Only list academic achievements","correct":false},{"id":"d","text":"Write longer descriptions","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Why should you incorporate keywords from job descriptions into your resume?', 10, 1,
     '[{"id":"a","text":"To impress hiring managers personally","correct":false},{"id":"b","text":"To pass Applicant Tracking Systems (ATS)","correct":true},{"id":"c","text":"To fill empty space","correct":false},{"id":"d","text":"For search engine optimization","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'How many projects are recommended for a diverse portfolio?', 10, 2,
     '[{"id":"a","text":"1-2","correct":false},{"id":"b","text":"3-5","correct":true},{"id":"c","text":"10+","correct":false},{"id":"d","text":"20+","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'Quantifying your achievements with metrics like percentage improvements strengthens your resume.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What should a well-structured portfolio project include first?', 10, 4,
     '[{"id":"a","text":"The source code","correct":false},{"id":"b","text":"Problem statement and objectives","correct":true},{"id":"c","text":"Future improvements","correct":false},{"id":"d","text":"Company logo","correct":false}]'::jsonb);

  -- ============================================================
  -- MODULE 10: Case Studies That Inspire
  -- ============================================================
  INSERT INTO modules (course_id, title, description, week, position, published)
  VALUES (v_course_id, 'Case Studies That Inspire', 'Real-world wins from the field—like predicting air traffic delays, detecting mental health crises, or optimizing multi-touch marketing. These examples show the impact data science has across industries.', 10, 9, true)
  RETURNING id INTO v_module_id;

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by)
  VALUES (v_course_id, v_module_id, 'page', 'Case Studies That Inspire', $md$<h2>Case Studies That Inspire</h2>
<p>These real-world examples demonstrate how data science creates significant impact across diverse industries.</p>
<h3>Healthcare: Early Detection of Sepsis</h3>
<p><strong>Challenge:</strong> Sepsis is difficult to detect early but becomes increasingly deadly with each hour of delayed treatment.</p>
<p><strong>Approach:</strong> A team at Johns Hopkins developed a machine learning system that continuously analyzes patient vital signs, lab results, and medical history to identify subtle patterns indicating sepsis risk.</p>
<p><strong>Impact:</strong></p>
<ul><li>60% improvement in early detection</li><li>20% reduction in mortality</li><li>$7.5M annual savings from reduced ICU stays</li></ul>
<h3>Transportation: Air Traffic Delay Prediction</h3>
<p><strong>Challenge:</strong> Flight delays cost airlines billions annually and create cascading disruptions throughout the transportation network.</p>
<p><strong>Approach:</strong> A major airline built a predictive system incorporating weather data, historical flight records, airport congestion metrics, and maintenance schedules.</p>
<p><strong>Impact:</strong></p>
<ul><li>37% reduction in preventable delays</li><li>$25M annual savings in operational costs</li><li>Improved customer satisfaction scores by 15%</li></ul>
<h3>Digital Marketing: Multi-Touch Attribution</h3>
<p><strong>Challenge:</strong> Traditional marketing attribution models failed to capture the complex customer journey across multiple channels.</p>
<p><strong>Approach:</strong> A retail company implemented a machine learning model using Markov chains to analyze thousands of customer journeys and assign appropriate credit to each marketing channel.</p>
<p><strong>Impact:</strong></p>
<ul><li>22% improvement in marketing ROI</li><li>Reallocated $3.5M to previously undervalued channels</li><li>18% increase in conversion rates</li></ul>
<h3>Financial Services: Fraud Detection</h3>
<p><strong>Challenge:</strong> Traditional rule-based fraud detection systems couldn't keep pace with sophisticated schemes.</p>
<p><strong>Approach:</strong> A payment processor deployed an ensemble of models combining anomaly detection, network analysis, and behavioral patterns to identify fraudulent transactions in real-time.</p>
<p><strong>Impact:</strong></p>
<ul><li>65% reduction in false positives</li><li>$12M in prevented fraud losses in first year</li><li>200ms average decision time</li></ul>
<h3>Agriculture: Precision Farming</h3>
<p><strong>Challenge:</strong> Climate change and resource constraints required farmers to optimize crop yields while minimizing water and fertilizer usage.</p>
<p><strong>Approach:</strong> An agtech company developed a system using satellite imagery, soil sensors, and weather data to provide field-specific recommendations.</p>
<p><strong>Impact:</strong></p>
<ul><li>15% increase in yield per acre</li><li>23% reduction in water usage</li><li>18% reduction in fertilizer application</li></ul>
<h3>Public Sector: Mental Health Crisis Response</h3>
<p><strong>Challenge:</strong> Emergency services struggled to identify mental health crisis calls and dispatch appropriate resources.</p>
<p><strong>Approach:</strong> A major city implemented natural language processing to analyze 911 call transcripts in real-time, flagging likely mental health emergencies.</p>
<p><strong>Impact:</strong></p>
<ul><li>72% improvement in identifying mental health crises</li><li>40% reduction in use of force during these incidents</li><li>Appropriate cases diverted to mental health professionals instead of police</li></ul>$md$, 0, true, v_instructor_id);

  INSERT INTO content_items (course_id, module_id, type, title, content, position, published, created_by, settings)
  VALUES (v_course_id, v_module_id, 'quiz', 'Module 10 Quiz: Case Studies', '<p>Test your knowledge of real-world data science case studies.</p>', 1, true, v_instructor_id,
    '{"time_limit": 15, "points_possible": 50, "allowed_attempts": 3, "quiz_type": "assignment"}'::jsonb)
  RETURNING id INTO v_quiz_content_id;

  INSERT INTO quizzes (content_item_id, title, description, quiz_type, time_limit, points_possible, allowed_attempts, show_correct_answers, shuffle_answers)
  VALUES (v_quiz_content_id, 'Module 10 Quiz: Case Studies', 'Test your knowledge of real-world data science case studies.', 'assignment', 15, 50, 3, true, true)
  RETURNING id INTO v_quiz_id;

  INSERT INTO quiz_questions (quiz_id, question_type, question_text, points, position, answers) VALUES
    (v_quiz_id, 'multiple_choice', 'In the sepsis detection case study, what was the approximate reduction in mortality?', 10, 0,
     '[{"id":"a","text":"5%","correct":false},{"id":"b","text":"20%","correct":true},{"id":"c","text":"50%","correct":false},{"id":"d","text":"75%","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which technique did the retail company use for multi-touch marketing attribution?', 10, 1,
     '[{"id":"a","text":"Neural networks","correct":false},{"id":"b","text":"Markov chains","correct":true},{"id":"c","text":"Linear regression","correct":false},{"id":"d","text":"Random forests","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'What was the average decision time for the financial fraud detection system?', 10, 2,
     '[{"id":"a","text":"200ms","correct":true},{"id":"b","text":"2 seconds","correct":false},{"id":"c","text":"30 seconds","correct":false},{"id":"d","text":"5 minutes","correct":false}]'::jsonb),
    (v_quiz_id, 'true_false', 'Precision farming used satellite imagery, soil sensors, and weather data to optimize crop yields.', 10, 3,
     '[{"id":"true","text":"True","correct":true},{"id":"false","text":"False","correct":false}]'::jsonb),
    (v_quiz_id, 'multiple_choice', 'Which data science technique was used to analyze 911 calls for mental health crises?', 10, 4,
     '[{"id":"a","text":"Computer vision","correct":false},{"id":"b","text":"Natural Language Processing (NLP)","correct":true},{"id":"c","text":"Reinforcement learning","correct":false},{"id":"d","text":"Time series forecasting","correct":false}]'::jsonb);

  RAISE NOTICE 'Data Blueprint course created successfully with 10 modules, 10 lessons, 10 quizzes, and 50 questions.';
END $$;
