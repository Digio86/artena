<?php
/*
Template Name: Contatti
*/
get_header(); ?>

 <?php get_template_part( 'template-parts/featured-image' ); ?>

<?php while ( have_posts() ) : the_post(); ?>
<div id="contatti" role="main">
  <header>
      <h1 class="entry-title"><?php the_title(); ?></h1>
  </header >
  <div class="info">
    Informazioni
  </div>

  <div class="form-contatti">
    <?php the_content(); ?>
  </div>
</div>
  <?php endwhile;?>

<?php get_footer();
