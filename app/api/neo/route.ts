import { NextRequest, NextResponse } from 'next/server';
import { readStore } from '@/lib/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = await readStore();
    const profile = store.profile;

    if (body.action === 'analyze') {
      const job = body.job;
      if (!job) {
        return NextResponse.json({ error: 'Job is required' }, { status: 400 });
      }

      const jobText = (job.title + ' ' + job.description).toLowerCase();
      const resumeText = (profile?.resumeText || '').toLowerCase();
      const skills = profile?.skills || [];
      
      const matchedSkills = skills.filter((skill) => 
        skill && resumeText.includes(skill.toLowerCase()) && jobText.includes(skill.toLowerCase())
      );
      const missingSkills = skills.filter((skill) => 
        skill && !resumeText.includes(skill.toLowerCase()) && jobText.includes(skill.toLowerCase())
      );
      
      const score = Math.min(99, 30 + matchedSkills.length * 15 + (resumeText.length > 100 ? 10 : 0));
      
      const suggestions = [];
      if (missingSkills.length > 0) {
        suggestions.push('Consider highlighting: ' + missingSkills.slice(0, 3).join(', '));
      }
      if (matchedSkills.length > 0) {
        suggestions.push('Emphasize: ' + matchedSkills.slice(0, 3).join(', '));
      }
      suggestions.push('Tailor resume to match job description');
      suggestions.push('Apply early for better visibility');
      
      return NextResponse.json({
        matchScore: score,
        matchedSkills,
        missingSkills,
        suggestions,
        recommendation: score >= 80 ? 'Strong match - apply now' : score >= 60 ? 'Good match - worth applying' : 'Review fit'
      });
    }

    if (body.action === 'auto_apply_suggest') {
      const jobs = store.jobs || [];
      const topMatches = jobs
        .filter(j => j.match >= 70)
        .sort((a, b) => b.match - a.match)
        .slice(0, 5);
      
      return NextResponse.json({
        suggestions: topMatches.map(job => ({
          job,
          reason: 'Match ' + job.match + '%',
          action: 'Apply on employer site'
        })),
        message: topMatches.length > 0 
          ? 'JoblyAI found ' + topMatches.length + ' strong matches. Apply early!'
          : 'Search for jobs to get recommendations.'
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

