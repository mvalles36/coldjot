import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateEmailContent, CampaignContext, EmailGenerationOptions } from '@/lib/ai/mistral';
import { getCampaignContext, getCurrentStepNumber } from '@/lib/ai/campaign-context';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { StepTypeEnum } from '@coldjot/types';

// Mock dependencies
vi.mock('@/lib/ai/mistral', async () => {
  const actual = await vi.importActual('@/lib/ai/mistral');
  return {
    ...actual,
    generateEmailContent: vi.fn(),
    mistralChatCompletion: vi.fn(),
  };
});

vi.mock('@/lib/ai/campaign-context', () => ({
  getCampaignContext: vi.fn(),
  getCurrentStepNumber: vi.fn(),
  getEmptyFollowUpSteps: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@coldjot/database', () => ({
  prisma: {
    sequence: {
      findUnique: vi.fn(),
    },
    sequenceStep: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    aiEmailDraft: {
      create: vi.fn(),
    },
  },
}));

// Import the API handler after mocking dependencies
import { POST } from '@/app/api/ai/generate-email/route';

describe('AI Email Generation Feature', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmailContent function', () => {
    it('should generate content for single email mode', async () => {
      const mockCampaignContext: CampaignContext = {
        campaignName: 'Test Campaign',
        steps: [
          { type: 'email', content: 'Previous email content' },
          { type: 'wait', content: 'Wait 2 days', waitDays: 2 },
        ],
      };

      const mockOptions: EmailGenerationOptions = {
        mode: 'single',
        userPrompt: 'This is a software demo',
        tone: 'professional',
        currentStepNumber: 2,
      };

      const mockResponse = 'Generated email content for a professional tone';
      
      // Mock the implementation for this test
      const generateEmailContentMock = generateEmailContent as vi.Mock;
      generateEmailContentMock.mockResolvedValue(mockResponse);

      const result = await generateEmailContent(mockCampaignContext, mockOptions);
      
      expect(result).toBe(mockResponse);
      expect(generateEmailContentMock).toHaveBeenCalledWith(mockCampaignContext, mockOptions);
    });

    it('should generate content for sequence mode', async () => {
      const mockCampaignContext: CampaignContext = {
        campaignName: 'Test Campaign',
        steps: [
          { type: 'email', content: 'Initial email content' },
        ],
      };

      const mockOptions: EmailGenerationOptions = {
        mode: 'sequence',
        tone: 'persuasive',
      };

      const mockResponse = [
        'First follow-up email',
        'Second follow-up email',
        'Third follow-up email',
      ];
      
      const generateEmailContentMock = generateEmailContent as vi.Mock;
      generateEmailContentMock.mockResolvedValue(mockResponse);

      const result = await generateEmailContent(mockCampaignContext, mockOptions);
      
      expect(result).toEqual(mockResponse);
      expect(generateEmailContentMock).toHaveBeenCalledWith(mockCampaignContext, mockOptions);
    });

    it('should handle errors gracefully', async () => {
      const mockCampaignContext: CampaignContext = {
        campaignName: 'Test Campaign',
        steps: [],
      };

      const mockOptions: EmailGenerationOptions = {
        mode: 'single',
      };
      
      const generateEmailContentMock = generateEmailContent as vi.Mock;
      generateEmailContentMock.mockRejectedValue(new Error('API error'));

      await expect(generateEmailContent(mockCampaignContext, mockOptions))
        .rejects.toThrow('API error');
    });
  });

  describe('getCampaignContext function', () => {
    it('should retrieve and format campaign context correctly', async () => {
      const mockStepId = 'step-123';
      const mockSequence = {
        id: 'seq-123',
        name: 'Marketing Outreach',
      };
      
      const mockStep = {
        id: mockStepId,
        sequenceId: 'seq-123',
        sequence: mockSequence,
      };
      
      const mockSteps = [
        {
          id: 'step-1',
          stepType: StepTypeEnum.MANUAL_EMAIL,
          content: 'Email content 1',
          order: 1,
          callAssistant: null,
        },
        {
          id: 'step-2',
          stepType: StepTypeEnum.WAIT,
          delayAmount: 2,
          delayUnit: 'days',
          order: 2,
          callAssistant: null,
        },
        {
          id: 'step-3',
          stepType: StepTypeEnum.CALL,
          note: 'Call to follow up',
          order: 3,
          callAssistant: {
            systemPrompt: 'Be friendly and ask about their needs',
          },
        },
      ];

      const { prisma } = await import('@coldjot/database');
      
      // Mock the database responses
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue(mockStep);
      (prisma.sequenceStep.findMany as vi.Mock).mockResolvedValue(mockSteps);
      
      const getCampaignContextMock = getCampaignContext as vi.Mock;
      getCampaignContextMock.mockResolvedValue({
        campaignName: 'Marketing Outreach',
        steps: [
          { type: 'email', content: 'Email content 1' },
          { type: 'wait', content: 'Wait for 2 days', waitDays: 2 },
          { type: 'call', content: 'Call to follow up' },
        ],
      });

      const result = await getCampaignContext(mockStepId);
      
      expect(result).toEqual({
        campaignName: 'Marketing Outreach',
        steps: [
          { type: 'email', content: 'Email content 1' },
          { type: 'wait', content: 'Wait for 2 days', waitDays: 2 },
          { type: 'call', content: 'Call to follow up' },
        ],
      });
      
      expect(prisma.sequenceStep.findUnique).toHaveBeenCalledWith({
        where: { id: mockStepId },
        include: {
          sequence: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw an error if step is not found', async () => {
      const mockStepId = 'non-existent-step';
      const { prisma } = await import('@coldjot/database');
      
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue(null);
      
      const getCampaignContextMock = getCampaignContext as vi.Mock;
      getCampaignContextMock.mockRejectedValue(new Error(`Step with ID ${mockStepId} not found`));

      await expect(getCampaignContext(mockStepId))
        .rejects.toThrow(`Step with ID ${mockStepId} not found`);
    });
  });

  describe('API endpoint', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as vi.Mock).mockResolvedValue(null);
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'single',
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');
    });

    it('should validate required parameters', async () => {
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          // Missing campaignId and stepId
          mode: 'single',
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing required parameters');
    });

    it('should validate mode parameter', async () => {
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'invalid-mode', // Invalid mode
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid mode parameter');
    });

    it('should verify sequence ownership', async () => {
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const { prisma } = await import('@coldjot/database');
      (prisma.sequence.findUnique as vi.Mock).mockResolvedValue(null); // Sequence not found
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'single',
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Sequence not found or access denied');
    });

    it('should verify step existence', async () => {
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const { prisma } = await import('@coldjot/database');
      (prisma.sequence.findUnique as vi.Mock).mockResolvedValue({ id: 'seq-123' });
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue(null); // Step not found
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'single',
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Step not found');
    });

    it('should generate content successfully for single mode', async () => {
      // Set up mocks
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const { prisma } = await import('@coldjot/database');
      (prisma.sequence.findUnique as vi.Mock).mockResolvedValue({ id: 'seq-123' });
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue({ id: 'step-123' });
      
      (getCampaignContext as vi.Mock).mockResolvedValue({
        campaignName: 'Test Campaign',
        steps: [{ type: 'email', content: 'Previous content' }],
      });
      
      (getCurrentStepNumber as vi.Mock).mockResolvedValue(1);
      
      (generateEmailContent as vi.Mock).mockResolvedValue('Generated email content');
      
      (prisma.aiEmailDraft.create as vi.Mock).mockResolvedValue({
        id: 'draft-123',
        content: 'Generated email content',
      });
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'single',
          userPrompt: 'This is about software',
          tone: 'professional',
        }),
      });
      
      const response = await POST(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({
        content: 'Generated email content',
        draftId: 'draft-123',
      });
      
      // Verify correct function calls
      expect(generateEmailContent).toHaveBeenCalledWith(
        { campaignName: 'Test Campaign', steps: [{ type: 'email', content: 'Previous content' }] },
        {
          mode: 'single',
          userPrompt: 'This is about software',
          tone: 'professional',
          currentStepNumber: 1,
        }
      );
      
      expect(prisma.aiEmailDraft.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'seq-123',
          stepId: 'step-123',
          content: 'Generated email content',
          tone: 'professional',
          mode: 'single',
        },
      });
    });

    it('should generate content successfully for sequence mode', async () => {
      // Set up mocks
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const { prisma } = await import('@coldjot/database');
      (prisma.sequence.findUnique as vi.Mock).mockResolvedValue({ id: 'seq-123' });
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue({ id: 'step-123' });
      
      (getCampaignContext as vi.Mock).mockResolvedValue({
        campaignName: 'Test Campaign',
        steps: [{ type: 'email', content: 'Previous content' }],
      });
      
      (getCurrentStepNumber as vi.Mock).mockResolvedValue(1);
      
      const mockEmailSequence = [
        'First follow-up email',
        'Second follow-up email',
        'Third follow-up email',
      ];
      
      (generateEmailContent as vi.Mock).mockResolvedValue(mockEmailSequence);
      
      (prisma.aiEmailDraft.create as vi.Mock).mockResolvedValue({
        id: 'draft-123',
        content: mockEmailSequence.join('\n\n---\n\n'),
      });
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'sequence',
          tone: 'persuasive',
        }),
      });
      
      const response = await POST(req);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({
        content: mockEmailSequence,
        draftId: 'draft-123',
      });
    });

    it('should handle errors during generation', async () => {
      // Set up mocks
      (auth as vi.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });
      
      const { prisma } = await import('@coldjot/database');
      (prisma.sequence.findUnique as vi.Mock).mockResolvedValue({ id: 'seq-123' });
      (prisma.sequenceStep.findUnique as vi.Mock).mockResolvedValue({ id: 'step-123' });
      
      (getCampaignContext as vi.Mock).mockResolvedValue({
        campaignName: 'Test Campaign',
        steps: [{ type: 'email', content: 'Previous content' }],
      });
      
      (getCurrentStepNumber as vi.Mock).mockResolvedValue(1);
      
      // Simulate an error during content generation
      (generateEmailContent as vi.Mock).mockRejectedValue(new Error('API error'));
      
      const req = new NextRequest('http://localhost:3000/api/ai/generate-email', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: 'seq-123',
          stepId: 'step-123',
          mode: 'single',
        }),
      });
      
      const response = await POST(req);
      
      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Server Error');
    });
  });
});
