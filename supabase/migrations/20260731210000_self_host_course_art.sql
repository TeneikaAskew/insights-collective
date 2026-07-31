-- Course cover art was hotlinked from images.unsplash.com, and those requests
-- fail for some users (network filtering / hotlink throttling), leaving broken
-- image icons on the dashboard, catalog, and course detail. The five images
-- now ship with the app under /course-art (public/), so covers load from the
-- site's own origin. Guarded by the unsplash prefix so any course whose art
-- was already replaced by an instructor is left alone.

update public.courses set
  image_url = '/course-art/visualization-with-tableau.jpg',
  thumbnail = '/course-art/visualization-with-tableau.jpg'
where title = 'Visualization with Tableau'
  and image_url like 'https://images.unsplash.com%';

update public.courses set
  image_url = '/course-art/data-engineering-fundamentals.jpg',
  thumbnail = '/course-art/data-engineering-fundamentals.jpg'
where title = 'Data Engineering Fundamentals'
  and image_url like 'https://images.unsplash.com%';

update public.courses set
  image_url = '/course-art/business-analytics-with-python.jpg',
  thumbnail = '/course-art/business-analytics-with-python.jpg'
where title = 'Business Analytics with Python'
  and image_url like 'https://images.unsplash.com%';

update public.courses set
  image_url = '/course-art/advanced-machine-learning.jpg',
  thumbnail = '/course-art/advanced-machine-learning.jpg'
where title = 'Advanced Machine Learning'
  and image_url like 'https://images.unsplash.com%';

update public.courses set
  image_url = '/course-art/introduction-to-data-science.jpg',
  thumbnail = '/course-art/introduction-to-data-science.jpg'
where title = 'Introduction to Data Science'
  and image_url like 'https://images.unsplash.com%';
