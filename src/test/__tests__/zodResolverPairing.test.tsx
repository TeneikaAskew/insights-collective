// ABOUTME: Proves the zod + @hookform/resolvers pairing at RUN time, not just at type-check time: an invalid
// ABOUTME: submission must surface the schema's own message through react-hook-form, and a valid one must
// ABOUTME: reach onSubmit. zod 4 removed ZodError.errors, which @hookform/resolvers 3.x read; the four forms
// ABOUTME: using zodResolver (BlogSettings, BlogPostForm, ProfileForm, AssignmentSubmission) have no such test.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  interests: z.string().min(3, { message: 'Interests must be at least 3 characters.' }),
  years: z.number().min(0, { message: 'Years cannot be negative.' }),
});
type Values = z.infer<typeof schema>;

function Harness({ onSubmit }: { onSubmit: (v: Values) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { interests: '', years: 0 } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input aria-label="interests" {...form.register('interests')} />
      <input aria-label="years" type="number" {...form.register('years', { valueAsNumber: true })} />
      <p role="alert">{form.formState.errors.interests?.message ?? form.formState.errors.years?.message ?? ''}</p>
      <button type="submit">save</button>
    </form>
  );
}

describe('zodResolver + zod pairing (runtime)', () => {
  it('surfaces the schema message on an invalid submission and does not call onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText('interests'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByText('save'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Interests must be at least 3 characters.'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with parsed values when the submission is valid', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.input(screen.getByLabelText('interests'), { target: { value: 'data engineering' } });
    fireEvent.input(screen.getByLabelText('years'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('save'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual({ interests: 'data engineering', years: 4 });
    expect(screen.getByRole('alert').textContent).toBe('');
  });
});
