from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.api.auth import get_current_user
from app.models import User, Project, ProjectMember, UserRole
from app.models.project_member import ProjectRole
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectWithDetails,
    ProjectWithMembers,
    ProjectMemberCreate,
    ProjectMemberResponse,
)

router = APIRouter()


def check_project_access(
    project: Project, user: User, required_roles: List[ProjectRole] = None
) -> bool:
    """Check if user has access to project with optional role requirement."""
    if user.role == UserRole.ADMIN:
        return True
    if project.owner_id == user.id:
        return True
    membership = next(
        (m for m in project.members if m.user_id == user.id), None
    )
    if membership:
        if required_roles is None:
            return True
        return membership.role in required_roles
    return False


@router.post("/", response_model=ProjectWithDetails, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new project. Available to PI, Researcher, Admin."""
    if current_user.role not in [UserRole.ADMIN, UserRole.PI, UserRole.RESEARCHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin, PI or Researcher can create projects",
        )

    # Check if project name already exists
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project with this name already exists",
        )

    db_project = Project(
        name=project.name,
        description=project.description,
        owner_id=current_user.id,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # Add owner as member with OWNER role
    owner_member = ProjectMember(
        project_id=db_project.id,
        user_id=current_user.id,
        role=ProjectRole.OWNER,
    )
    db.add(owner_member)
    db.commit()

    return ProjectWithDetails(
        id=db_project.id,
        name=db_project.name,
        description=db_project.description,
        owner_id=db_project.owner_id,
        created_at=db_project.created_at,
        updated_at=db_project.updated_at,
        owner_username=current_user.username,
        member_count=1,
        workload_count=0,
        platform_count=0,
        scenario_count=0,
        strategy_count=0,
        experiment_count=0,
    )


@router.get("/", response_model=List[ProjectWithDetails])
def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List projects accessible to current user."""
    if current_user.role == UserRole.ADMIN:
        # Admin sees all projects
        projects = db.query(Project).offset(skip).limit(limit).all()
    else:
        # Others see owned projects + projects they're members of
        owned_projects = db.query(Project).filter(
            Project.owner_id == current_user.id
        ).all()

        member_project_ids = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == current_user.id
        ).all()
        member_project_ids = [p[0] for p in member_project_ids]

        member_projects = db.query(Project).filter(
            Project.id.in_(member_project_ids),
            Project.owner_id != current_user.id
        ).all()

        projects = owned_projects + member_projects
        projects = projects[skip : skip + limit]

    result = []
    for p in projects:
        result.append(
            ProjectWithDetails(
                id=p.id,
                name=p.name,
                description=p.description,
                owner_id=p.owner_id,
                created_at=p.created_at,
                updated_at=p.updated_at,
                owner_username=p.owner.username if p.owner else None,
                member_count=len(p.members),
                workload_count=len(p.workloads),
                platform_count=len(p.platforms),
                scenario_count=len(p.scenarios),
                strategy_count=len(p.strategies),
                experiment_count=len(p.experiments),
            )
        )
    return result


@router.get("/{project_id}", response_model=ProjectWithMembers)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get project details with members."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if not check_project_access(project, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this project",
        )

    members = []
    for m in project.members:
        members.append(
            ProjectMemberResponse(
                id=m.id,
                project_id=m.project_id,
                user_id=m.user_id,
                role=m.role,
                created_at=m.created_at,
                username=m.user.username if m.user else None,
                email=m.user.email if m.user else None,
            )
        )

    return ProjectWithMembers(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        owner_username=project.owner.username if project.owner else None,
        members=members,
    )


@router.put("/{project_id}", response_model=ProjectWithDetails)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update project. Only owner or admin can update."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if not check_project_access(project, current_user, [ProjectRole.OWNER]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner can update project",
        )

    if project_update.name is not None:
        # Check uniqueness
        existing = db.query(Project).filter(
            Project.name == project_update.name,
            Project.id != project_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project with this name already exists",
            )
        project.name = project_update.name

    if project_update.description is not None:
        project.description = project_update.description

    db.commit()
    db.refresh(project)

    return ProjectWithDetails(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        owner_username=project.owner.username if project.owner else None,
        member_count=len(project.members),
        workload_count=len(project.workloads),
        platform_count=len(project.platforms),
        scenario_count=len(project.scenarios),
        strategy_count=len(project.strategies),
        experiment_count=len(project.experiments),
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete project. Only owner or admin can delete."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if project.owner_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner or admin can delete project",
        )

    db.delete(project)
    db.commit()
    return None


# Member management endpoints

@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
def add_member(
    project_id: int,
    member: ProjectMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add member to project. Only owner or admin can add members."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if not check_project_access(project, current_user, [ProjectRole.OWNER]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner can add members",
        )

    # Check if user exists
    user = db.query(User).filter(User.id == member.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if already member
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member.user_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project",
        )

    db_member = ProjectMember(
        project_id=project_id,
        user_id=member.user_id,
        role=member.role,
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)

    return ProjectMemberResponse(
        id=db_member.id,
        project_id=db_member.project_id,
        user_id=db_member.user_id,
        role=db_member.role,
        created_at=db_member.created_at,
        username=user.username,
        email=user.email,
    )


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def list_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List project members."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if not check_project_access(project, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this project",
        )

    members = []
    for m in project.members:
        members.append(
            ProjectMemberResponse(
                id=m.id,
                project_id=m.project_id,
                user_id=m.user_id,
                role=m.role,
                created_at=m.created_at,
                username=m.user.username if m.user else None,
                email=m.user.email if m.user else None,
            )
        )
    return members


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove member from project. Only owner or admin can remove members."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if not check_project_access(project, current_user, [ProjectRole.OWNER]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only project owner can remove members",
        )

    # Cannot remove owner
    if user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove project owner",
        )

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    db.delete(member)
    db.commit()
    return None
