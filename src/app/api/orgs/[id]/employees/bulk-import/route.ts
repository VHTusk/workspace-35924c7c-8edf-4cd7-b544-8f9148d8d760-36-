// API: Bulk Import Employees
// POST /api/orgs/[id]/employees/bulk-import - Bulk import employees from CSV data

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { validateOrgSession } from '@/lib/auth';
import { SportType } from '@prisma/client';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (supports Indian phone formats)
const PHONE_REGEX = /^(\+?91[-.\s]?)?[6-9]\d{9}$/;

// Validation result type
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Employee row from CSV
interface EmployeeRow {
  employee_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department?: string;
  designation?: string;
}

// Validate a single employee row
function validateEmployeeRow(
  row: EmployeeRow,
  rowIndex: number,
  existingEmails: Set<string>,
  existingEmployeeIds: Set<string>,
  csvEmails: Map<string, number>,
  csvEmployeeIds: Map<string, number>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!row.email || row.email.trim() === '') {
    errors.push(`Row ${rowIndex}: Email is required`);
  } else if (!EMAIL_REGEX.test(row.email.trim())) {
    errors.push(`Row ${rowIndex}: Invalid email format "${row.email}"`);
  }

  if (!row.first_name || row.first_name.trim() === '') {
    errors.push(`Row ${rowIndex}: First name is required`);
  }

  if (!row.last_name || row.last_name.trim() === '') {
    errors.push(`Row ${rowIndex}: Last name is required`);
  }

  // Validate phone format if provided
  if (row.phone && row.phone.trim() !== '') {
    const cleanPhone = row.phone.replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      errors.push(`Row ${rowIndex}: Invalid phone format "${row.phone}"`);
    }
  }

  // Check for duplicates within CSV
  if (row.email) {
    const email = row.email.toLowerCase().trim();
    if (csvEmails.has(email) && csvEmails.get(email) !== rowIndex) {
      errors.push(`Row ${rowIndex}: Duplicate email "${row.email}" found in row ${csvEmails.get(email)}`);
    }
  }

  // Check for duplicate employee IDs within CSV
  if (row.employee_id && row.employee_id.trim() !== '') {
    const empId = row.employee_id.trim();
    if (csvEmployeeIds.has(empId) && csvEmployeeIds.get(empId) !== rowIndex) {
      warnings.push(`Row ${rowIndex}: Duplicate employee ID "${row.employee_id}" found in row ${csvEmployeeIds.get(empId)}`);
    }
  }

  // Check for existing employees in database
  if (row.email) {
    const email = row.email.toLowerCase().trim();
    if (existingEmails.has(email)) {
      warnings.push(`Row ${rowIndex}: Employee with email "${row.email}" already exists in database`);
    }
  }

  if (row.employee_id && row.employee_id.trim() !== '') {
    const empId = row.employee_id.trim();
    if (existingEmployeeIds.has(empId)) {
      warnings.push(`Row ${rowIndex}: Employee ID "${row.employee_id}" already exists in database`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// POST - Bulk import employees
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await validateOrgSession(sessionToken);
    if (!session || !session.org) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const { id: orgId } = await params;

    // Verify the org matches the session
    if (orgId !== session.org.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only CORPORATE organizations can use bulk import
    if (session.org.type !== 'CORPORATE') {
      return NextResponse.json(
        { error: 'Only corporate organizations can use bulk import' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { 
      employees, 
      sport, 
      sendInvites = false,
      skipDuplicates = true,
    } = body as {
      employees: EmployeeRow[];
      sport: SportType;
      sendInvites?: boolean;
      skipDuplicates?: boolean;
    };

    // Validate sport
    if (!sport || !['CORNHOLE', 'DARTS'].includes(sport)) {
      return NextResponse.json(
        { error: 'Valid sport parameter required (CORNHOLE or DARTS)' },
        { status: 400 }
      );
    }

    // Validate employees array
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json(
        { error: 'No employee data provided' },
        { status: 400 }
      );
    }

    // Limit batch size
    if (employees.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 employees can be imported at once' },
        { status: 400 }
      );
    }

    // Get existing employees for duplicate checking
    const existingEmployees = await db.employee.findMany({
      where: {
        orgId,
        sport,
        isActive: true,
      },
      select: {
        email: true,
        employeeId: true,
      },
    });

    const existingEmails = new Set(
      existingEmployees.map(e => e.email.toLowerCase())
    );
    const existingEmployeeIds = new Set(
      existingEmployees.filter(e => e.employeeId).map(e => e.employeeId as string)
    );

    // Build maps for CSV duplicate detection
    const csvEmails = new Map<string, number>();
    const csvEmployeeIds = new Map<string, number>();

    employees.forEach((row, index) => {
      if (row.email) {
        csvEmails.set(row.email.toLowerCase().trim(), index + 1);
      }
      if (row.employee_id && row.employee_id.trim() !== '') {
        csvEmployeeIds.set(row.employee_id.trim(), index + 1);
      }
    });

    // Get department name to ID mapping
    const departments = await db.corporateDepartment.findMany({
      where: {
        orgId,
        sport,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const departmentMap = new Map<string, string>();
    departments.forEach(dept => {
      departmentMap.set(dept.name.toLowerCase(), dept.id);
    });

    // Validate all rows
    const validationResults = employees.map((row, index) => ({
      row,
      rowIndex: index + 1,
      validation: validateEmployeeRow(
        row,
        index + 1,
        existingEmails,
        existingEmployeeIds,
        csvEmails,
        csvEmployeeIds
      ),
    }));

    // Separate valid and invalid rows
    const validRows = validationResults.filter(r => r.validation.isValid);
    const invalidRows = validationResults.filter(r => !r.validation.isValid);

    // If any rows have errors, return validation summary
    if (invalidRows.length > 0 && !skipDuplicates) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        validation: {
          totalRows: employees.length,
          validRows: validRows.length,
          invalidRows: invalidRows.length,
          errors: invalidRows.flatMap(r => r.validation.errors),
          warnings: validationResults.flatMap(r => r.validation.warnings),
        },
      }, { status: 400 });
    }

    // Filter out duplicates if skipDuplicates is true
    const rowsToImport = validRows.filter(r => {
      const email = r.row.email.toLowerCase().trim();
      return !existingEmails.has(email);
    });

    // Create employees in bulk
    const createdEmployees: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      department?: string;
    }> = [];

    const skippedEmployees: Array<{
      email: string;
      reason: string;
    }> = [];

    const errorEmployees: Array<{
      email: string;
      error: string;
    }> = [];

    // Process in chunks of 50 to avoid timeouts
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rowsToImport.length; i += CHUNK_SIZE) {
      const chunk = rowsToImport.slice(i, i + CHUNK_SIZE);

      for (const { row, rowIndex } of chunk) {
        try {
          // Map department name to ID
          let departmentId: string | null = null;
          if (row.department && row.department.trim() !== '') {
            const deptId = departmentMap.get(row.department.toLowerCase().trim());
            if (deptId) {
              departmentId = deptId;
            }
          }

          const employee = await db.employee.create({
            data: {
              orgId,
              sport,
              email: row.email.toLowerCase().trim(),
              firstName: row.first_name.trim(),
              lastName: row.last_name.trim(),
              phone: row.phone?.trim() || null,
              employeeId: row.employee_id?.trim() || null,
              department: row.department?.trim() || null,
              departmentId,
              designation: row.designation?.trim() || null,
              isActive: true,
              isVerified: false,
            },
          });

          createdEmployees.push({
            id: employee.id,
            email: employee.email,
            firstName: employee.firstName,
            lastName: employee.lastName,
            department: employee.department || undefined,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errorEmployees.push({
            email: row.email,
            error: errorMsg,
          });
        }
      }
    }

    // Record skipped employees (duplicates)
    validRows
      .filter(r => {
        const email = r.row.email.toLowerCase().trim();
        return existingEmails.has(email);
      })
      .forEach(r => {
        skippedEmployees.push({
          email: r.row.email,
          reason: 'Employee with this email already exists',
        });
      });

    // Send invites if requested
    let invitesSent = 0;
    if (sendInvites && createdEmployees.length > 0) {
      // TODO: Implement email invitation system
      // For now, just log that invites would be sent
      console.log(`[Bulk Import] Would send ${createdEmployees.length} invites`);
      invitesSent = 0; // Placeholder
    }

    // Return summary
    return NextResponse.json({
      success: true,
      summary: {
        totalRows: employees.length,
        created: createdEmployees.length,
        skipped: skippedEmployees.length,
        errors: errorEmployees.length,
        invitesSent,
      },
      details: {
        created: createdEmployees,
        skipped: skippedEmployees,
        errors: errorEmployees,
        validation: {
          warnings: validationResults.flatMap(r => r.validation.warnings),
          invalidRows: invalidRows.map(r => ({
            row: r.rowIndex,
            data: r.row,
            errors: r.validation.errors,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk import' },
      { status: 500 }
    );
  }
}
