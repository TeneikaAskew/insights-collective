-- Update the current user to have instructor role for testing
UPDATE profiles 
SET roles = ARRAY['student', 'instructor'] 
WHERE id = '2ee16190-1429-44fa-9c49-e99b87bd3cec';