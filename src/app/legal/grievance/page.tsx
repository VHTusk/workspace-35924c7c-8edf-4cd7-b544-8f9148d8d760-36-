"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale, Clock, Users, CheckCircle, AlertCircle } from "lucide-react";

export default function GrievanceRedressalPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-slate-500/10">
            <Scale className="h-6 w-6 text-slate-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Grievance Redressal Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">Our Commitment</p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                VALORHIVE is committed to providing a fair and transparent grievance redressal mechanism for all users. We aim to resolve all complaints within the stipulated timelines.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Scope of Grievances</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">This policy covers grievances related to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Tournament conduct, decisions, and outcomes</li>
                <li>Payment and refund issues</li>
                <li>Account-related problems (suspension, ban, access issues)</li>
                <li>Leaderboard and ranking disputes</li>
                <li>Platform functionality issues affecting user experience</li>
                <li>Conduct of tournament directors, referees, or staff</li>
                <li>Harassment, discrimination, or safety concerns</li>
                <li>Intellectual property or content disputes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Grievance Officer</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                VALORHIVE has appointed a dedicated Grievance Officer for user complaints:
              </p>
              <div className="p-4 bg-muted/50 rounded-lg">
                <ul className="list-none space-y-1 text-muted-foreground">
                  <li><strong>Name:</strong> Grievance Redressal Officer</li>
                  <li><strong>Email:</strong> grievances@valorhive.com</li>
                  <li><strong>Phone:</strong> +91 98765 43210</li>
                  <li><strong>Address:</strong> VALORHIVE Sports Technologies Pvt. Ltd., Bengaluru, Karnataka, India</li>
                  <li><strong>Working Hours:</strong> Monday to Saturday, 9:00 AM to 6:00 PM IST</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. How to File a Grievance</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Users className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">Users may file grievances through the following channels:</p>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <p className="font-medium text-foreground mb-2">Option 1: In-App Submission (Recommended)</p>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Go to your Profile → Help & Support</li>
                    <li>Select &quot;Raise Grievance&quot;</li>
                    <li>Fill out the grievance form with complete details</li>
                    <li>Attach relevant documents/screenshots</li>
                    <li>Submit and receive acknowledgment with ticket number</li>
                  </ol>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <p className="font-medium text-foreground mb-2">Option 2: Email Submission</p>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Send email to grievances@valorhive.com</li>
                    <li>Include subject line: &quot;Grievance - [Your Name] - [Category]&quot;</li>
                    <li>Provide your registered email and phone number</li>
                    <li>Describe the grievance in detail</li>
                    <li>Attach supporting documents</li>
                  </ol>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <p className="font-medium text-foreground mb-2">Option 3: Written Submission</p>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Send a written complaint to the Grievance Officer&apos;s address</li>
                    <li>Include your name, contact details, and user ID</li>
                    <li>Describe the grievance clearly</li>
                    <li>Attach photocopies of relevant documents</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Required Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">Your grievance submission must include:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Complete name and registered contact details</li>
                <li>User ID or registered email address</li>
                <li>Clear description of the grievance</li>
                <li>Date and time when the issue occurred</li>
                <li>Names of individuals involved (if applicable)</li>
                <li>Relevant transaction/tournament IDs</li>
                <li>Supporting evidence (screenshots, receipts, communications)</li>
                <li>Desired resolution or outcome</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Incomplete submissions may be returned for additional information, which may delay processing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. Resolution Timeline</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="flex items-start gap-3 mb-4">
                <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">VALORHIVE follows these timelines as per IT Rules, 2011:</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 text-foreground">Stage</th>
                      <th className="text-left py-2 text-foreground">Timeline</th>
                      <th className="text-left py-2 text-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2 pr-4">Acknowledgment</td>
                      <td className="py-2">Within 48 hours</td>
                      <td className="py-2">Receipt of grievance confirmed with ticket number</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">Initial Response</td>
                      <td className="py-2">Within 7 days</td>
                      <td className="py-2">Preliminary assessment and response</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pr-4">Resolution</td>
                      <td className="py-2">Within 30 days</td>
                      <td className="py-2">Final resolution of the grievance</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Appeal Decision</td>
                      <td className="py-2">Within 45 days</td>
                      <td className="py-2">Decision on appeal (if applicable)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="text-muted-foreground mt-4">
                Complex grievances requiring investigation may take longer. Users will be informed of any delays with reasons.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Grievance Process</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Receipt & Registration</p>
                    <p className="text-sm text-muted-foreground">Grievance is logged and assigned a unique ticket number for tracking</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Assessment</p>
                    <p className="text-sm text-muted-foreground">Grievance Officer reviews the complaint and categorizes it</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Investigation</p>
                    <p className="text-sm text-muted-foreground">Relevant parties are contacted, evidence is reviewed</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">4</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Resolution</p>
                    <p className="text-sm text-muted-foreground">Decision is communicated to the complainant with reasons</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">5</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Implementation</p>
                    <p className="text-sm text-muted-foreground">Resolution is implemented (refund, correction, action, etc.)</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">7. Appeals Process</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground mb-4">
                If you are not satisfied with the resolution, you may appeal:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Appeal must be filed within 15 days of receiving the resolution</li>
                <li>Appeal should be sent to the Nodal Officer: nodal-officer@valorhive.com</li>
                <li>Provide grounds for appeal and new evidence (if any)</li>
                <li>The Nodal Officer will review the case independently</li>
                <li>Appeal decision is final and binding</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">8. Types of Resolutions</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="font-medium text-green-800 dark:text-green-300">Favorable Outcomes</p>
                  </div>
                  <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                    <li>• Full or partial refund</li>
                    <li>• Correction of rankings/records</li>
                    <li>• Account restoration</li>
                    <li>• Disciplinary action against offender</li>
                    <li>• Compensation (if applicable)</li>
                  </ul>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="font-medium text-red-800 dark:text-red-300">Possible Denial</p>
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                    <li>• Insufficient evidence</li>
                    <li>• Beyond jurisdiction</li>
                    <li>• Frivolous complaint</li>
                    <li>• Policy violation not found</li>
                    <li>• Time limitation exceeded</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">9. Escalation to External Authorities</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                If your grievance is not resolved within 30 days, or you are unsatisfied with the resolution, you may approach:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                <li><strong>Consumer Courts:</strong> For consumer disputes under Consumer Protection Act, 2019</li>
                <li><strong>Cyber Appellate Tribunal:</strong> For IT-related matters</li>
                <li><strong>Local Police:</strong> For criminal matters (fraud, harassment)</li>
                <li><strong>Online Dispute Resolution:</strong> Through government ODR portals</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">10. Confidentiality</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                All grievances are treated with strict confidentiality. Personal information of complainants is protected and not disclosed to third parties except as required by law or with explicit consent. Investigation details remain internal.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">11. Anti-Abuse Measures</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-muted-foreground">
                VALORHIVE maintains a zero-tolerance policy against false or frivolous complaints. Users found filing false grievances repeatedly may face:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                <li>Warning and temporary suspension from grievance filing</li>
                <li>Permanent ban from filing grievances</li>
                <li>Account suspension in severe cases</li>
                <li>Legal action for defamation or harassment</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">12. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground mb-2">Grievance Officer (First Level)</p>
                  <ul className="list-none text-sm text-muted-foreground space-y-1">
                    <li>Email: grievances@valorhive.com</li>
                    <li>Phone: +91 98765 43210</li>
                  </ul>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground mb-2">Nodal Officer (Appeal Level)</p>
                  <ul className="list-none text-sm text-muted-foreground space-y-1">
                    <li>Email: nodal-officer@valorhive.com</li>
                    <li>Phone: +91 98765 43210</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 VALORHIVE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
