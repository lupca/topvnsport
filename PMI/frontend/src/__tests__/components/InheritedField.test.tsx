import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { useForm, FormProvider } from 'react-hook-form';
import { InheritedField } from '@/components/products/channel/InheritedField';

interface WrapperProps {
  children: React.ReactNode;
  defaultValues: any;
}

function Wrapper({ children, defaultValues }: WrapperProps) {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('InheritedField', () => {
  test('shows "Từ master" badge when empty', () => {
    render(
      <Wrapper defaultValues={{ name: 'Master Name', channel_listings: [{ title_override: '' }] }}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </Wrapper>
    );
    
    expect(screen.getByText('Từ master')).toBeInTheDocument();
    expect(screen.queryByText('Tùy chỉnh')).not.toBeInTheDocument();
  });

  test('shows "Tùy chỉnh" badge when override is entered', async () => {
    render(
      <Wrapper defaultValues={{ name: 'Master Name', channel_listings: [{ title_override: 'Custom Title' }] }}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </Wrapper>
    );
    
    expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument();
    expect(screen.queryByText('Từ master')).not.toBeInTheDocument();
  });

  test('resets to master when Reset is clicked', async () => {
    render(
      <Wrapper defaultValues={{ name: 'Master Name', channel_listings: [{ title_override: 'Custom' }] }}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </Wrapper>
    );
    
    expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument();
    
    const resetButton = screen.getByRole('button', { name: /Reset/ });
    await userEvent.click(resetButton);
    
    expect(screen.getByText('Từ master')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  test('shows preview of master value when not overriding', () => {
    render(
      <Wrapper defaultValues={{ name: 'Master Product Name', channel_listings: [{ title_override: '' }] }}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </Wrapper>
    );
    
    expect(screen.getByText(/Giá trị sẽ dùng:/)).toBeInTheDocument();
    expect(screen.getByText(/Master Product Name/)).toBeInTheDocument();
  });

  test('uses placeholder from master value', () => {
    render(
      <Wrapper defaultValues={{ name: 'Master Name', channel_listings: [{ title_override: '' }] }}>
        <InheritedField 
          masterFieldName="name" 
          overrideFieldName="channel_listings.0.title_override"
          label="Title"
        />
      </Wrapper>
    );
    
    expect(screen.getByPlaceholderText('Master Name')).toBeInTheDocument();
  });
});
