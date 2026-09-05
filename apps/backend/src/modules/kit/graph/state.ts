import { Annotation } from '@langchain/langgraph';
import { Role, CompanyBrief, Question, Flashcard } from '@zeno/shared';

export interface CrawlerData {
  companyContext: string;
  hiringContext: string;
  publicDiscussion: string;
  pagesUsed: string[];
}

export interface KitGraphState {
  jdText: string;
  companyUrl?: string;
  crawlerData?: CrawlerData;
  role?: Role;
  companyBrief?: CompanyBrief;
  questions?: Question[];
  flashcards?: Flashcard[];
  uncoveredRequirementIds?: string[];
  passes: number;
}

/**
 * LangGraph State Annotation channel definitions for KitGraphState
 */
export const KitGraphAnnotation = Annotation.Root({
  jdText: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  companyUrl: Annotation<string | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  crawlerData: Annotation<CrawlerData | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  role: Annotation<Role | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  companyBrief: Annotation<CompanyBrief | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  questions: Annotation<Question[]>({
    reducer: (_prev, next) => next ?? [],
    default: () => [],
  }),
  flashcards: Annotation<Flashcard[]>({
    reducer: (_prev, next) => next ?? [],
    default: () => [],
  }),
  uncoveredRequirementIds: Annotation<string[]>({
    reducer: (_prev, next) => next ?? [],
    default: () => [],
  }),
  passes: Annotation<number>({
    reducer: (_prev, next) => next ?? 0,
    default: () => 0,
  }),
});
