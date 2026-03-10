import { PropsWithChildren } from 'react';
import { Space, Typography } from 'antd';

interface PageSectionProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  className?: string;
}

interface FormRowProps extends PropsWithChildren {
  className?: string;
}

interface ActionBarProps extends PropsWithChildren {
  className?: string;
}

interface FieldHintProps extends PropsWithChildren {
  id?: string;
}

export function PageSection({ title, subtitle, className, children }: PageSectionProps) {
  return (
    <section className={className || 'page-section'}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Title level={3}>{title}</Typography.Title>
        {subtitle ? <Typography.Paragraph className="section-subtitle">{subtitle}</Typography.Paragraph> : null}
      </Space>
      {children}
    </section>
  );
}

export function FormRow({ className, children }: FormRowProps) {
  return <div className={className || 'form-row'}>{children}</div>;
}

export function FieldHint({ id, children }: FieldHintProps) {
  return <Typography.Text id={id} type="secondary">{children}</Typography.Text>;
}

export function ActionBar({ className, children }: ActionBarProps) {
  return <div className={className || 'action-bar'}>{children}</div>;
}
